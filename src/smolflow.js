/**
 * Flow Framework - A node-based workflow execution library
 * Enhanced JavaScript implementation
 * @module FlowFramework
 */

const FlowFramework = (function () {
  /**
   * Configurable warning system
   * @namespace
   */
  const warnings = {
    /**
     * Collection of warning handlers
     * @type {Array<Function>}
     */
    handlers: [console.warn],

    /**
     * Issues a warning message to all registered handlers
     * @param {string} message - Warning message text
     */
    warn: function (message) {
      this.handlers.forEach(handler => handler(message));
    },

    /**
     * Adds a new warning handler
     * @param {Function} handler - Function that processes warning messages
     */
    addHandler: function (handler) {
      if (typeof handler !== 'function') {
        throw new TypeError('Warning handler must be a function');
      }
      this.handlers.push(handler);
    },

    /**
     * Removes all warning handlers
     */
    clearHandlers: function () {
      this.handlers = [];
    }
  };

  /**
   * Creates a deep copy of an object, handling circular references and special objects
   * @param {*} obj - The object to copy
   * @param {WeakMap} [visited=new WeakMap()] - Map of already visited objects for circular reference detection
   * @returns {*} A deep copy of the input object
   */
  function deepCopy(obj, visited = new WeakMap()) {
    // Handle primitives and null
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    // Handle circular references
    if (visited.has(obj)) {
      return visited.get(obj);
    }

    let copy;

    // Handle special object types
    if (obj instanceof Date) {
      copy = new Date(obj);
    } else if (obj instanceof RegExp) {
      copy = new RegExp(obj.source, obj.flags);
    } else if (obj instanceof Map) {
      copy = new Map();
      visited.set(obj, copy);
      obj.forEach((value, key) => {
        copy.set(deepCopy(key, visited), deepCopy(value, visited));
      });
    } else if (obj instanceof Set) {
      copy = new Set();
      visited.set(obj, copy);
      obj.forEach(value => {
        copy.add(deepCopy(value, visited));
      });
    } else if (Array.isArray(obj)) {
      copy = [];
      visited.set(obj, copy);
      obj.forEach((value, index) => {
        copy[index] = deepCopy(value, visited);
      });
    } else {
      // Handle plain objects
      copy = Object.create(Object.getPrototypeOf(obj));
      visited.set(obj, copy);

      Object.getOwnPropertyNames(obj).forEach(key => {
        const descriptor = Object.getOwnPropertyDescriptor(obj, key);
        if (descriptor.value !== undefined) {
          descriptor.value = deepCopy(descriptor.value, visited);
        }
        Object.defineProperty(copy, key, descriptor);
      });
    }

    return copy;
  }

  /**
   * Creates a shallow copy of an object
   * @param {Object} obj - The object to copy
   * @returns {Object} A shallow copy of the input object
   */
  function shallowCopy(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return [...obj];
    }

    return Object.assign(Object.create(Object.getPrototypeOf(obj)), obj);
  }

  /**
   * Type checking utilities
   * @namespace
   */
  const typeChecks = {
    /**
     * Validates that a value is a non-empty string
     * @param {*} value - The value to check
     * @param {string} name - Parameter name for error message
     * @throws {TypeError} If validation fails
     */
    validateString: function (value, name) {
      if (typeof value !== 'string') {
        throw new TypeError(`${name} must be a string`);
      }
    },

    /**
     * Validates that a value is a positive number
     * @param {*} value - The value to check
     * @param {string} name - Parameter name for error message
     * @throws {TypeError} If validation fails
     */
    validatePositiveNumber: function (value, name) {
      if (typeof value !== 'number' || isNaN(value) || value < 0) {
        throw new TypeError(`${name} must be a positive number`);
      }
    },

    /**
     * Validates that a value is an instance of a specific class
     * @param {*} value - The value to check
     * @param {Function} type - The constructor to check against
     * @param {string} name - Parameter name for error message
     * @throws {TypeError} If validation fails
     */
    validateInstance: function (value, type, name) {
      if (!(value instanceof type)) {
        throw new TypeError(`${name} must be an instance of ${type.name}`);
      }
    }
  };

  /**
   * Base class for all nodes in the flow framework
   * @class
   */
  class BaseNode {
    /**
     * Creates a new BaseNode instance
     * @constructor
     */
    constructor() {
      /**
       * Node parameters
       * @type {Object}
       */
      this.params = {};

      /**
       * Node successors mapped by action name
       * @type {Object<string, BaseNode>}
       */
      this.successors = {};
    }

    /**
     * Sets the parameters for this node
     * @param {Object} params - The parameters to set
     */
    setParams(params) {
      if (params === null || typeof params !== 'object') {
        throw new TypeError('Parameters must be an object');
      }
      this.params = params;
    }

    /**
     * Sets a successor node for a specific action
     * @param {BaseNode} node - The successor node
     * @param {string} [action="default"] - The action name
     * @returns {BaseNode} The successor node (for chaining)
     * @throws {TypeError} If node is not a BaseNode or action is not a string
     */
    next(node, action = "default") {
      if (!node || !(node instanceof BaseNode)) {
        throw new TypeError("Node must be a BaseNode instance");
      }

      typeChecks.validateString(action, "Action");

      if (this.successors[action]) {
        warnings.warn(`Overwriting successor for action '${action}'`);
      }

      this.successors[action] = node;
      return node;
    }

    /**
     * Preparation phase of node execution
     * @param {Object} shared - Shared context object
     * @returns {*} Preparation result to be passed to exec
     */
    prep(shared) {
      return null;
    }

    /**
     * Execution phase of node processing
     * @param {*} prepRes - Result from the prep phase
     * @returns {*} Execution result to be passed to post
     */
    exec(prepRes) {
      return null;
    }

    /**
     * Post-processing phase of node execution
     * @param {Object} shared - Shared context object
     * @param {*} prepRes - Result from the prep phase
     * @param {*} execRes - Result from the exec phase
     * @returns {*} Final result of node execution
     */
    post(shared, prepRes, execRes) {
      return execRes;
    }

    /**
     * Internal execution method (can be overridden by subclasses)
     * @param {*} prepRes - Result from the prep phase
     * @returns {*} Execution result
     * @protected
     */
    _exec(prepRes) {
      return this.exec(prepRes);
    }

    /**
     * Internal run method that orchestrates the execution phases
     * @param {Object} shared - Shared context object
     * @returns {*} Result of node execution
     * @protected
     */
    _run(shared) {
      const p = this.prep(shared);
      const e = this._exec(p);
      return this.post(shared, p, e);
    }

    /**
     * Executes this node
     * @param {Object} shared - Shared context object
     * @returns {*} Result of node execution
     */
    run(shared) {
      if (Object.keys(this.successors).length > 0) {
        warnings.warn("Node won't run successors. Use Flow.");
      }
      return this._run(shared);
    }

    /**
     * Alias for next() - provides a more fluent API
     * @param {BaseNode} other - The successor node
     * @returns {BaseNode} The successor node (for chaining)
     */
    connect(other) {
      return this.next(other);
    }

    /**
     * Creates a conditional transition from this node
     * @param {string} action - The action name for the transition
     * @returns {ConditionalTransition} A transition object
     * @throws {TypeError} If action is not a string
     */
    withTransition(action) {
      typeChecks.validateString(action, "Action");
      return new ConditionalTransition(this, action);
    }
  }

  /**
   * Helper class for conditional transitions between nodes
   * @class
   */
  class ConditionalTransition {
    /**
     * Creates a new conditional transition
     * @param {BaseNode} src - Source node
     * @param {string} action - Action name for the transition
     */
    constructor(src, action) {
      /**
       * Source node
       * @type {BaseNode}
       */
      this.src = src;

      /**
       * Action name
       * @type {string}
       */
      this.action = action;
    }

    /**
     * Connects this transition to a target node
     * @param {BaseNode} tgt - Target node
     * @returns {BaseNode} The target node (for chaining)
     */
    connect(tgt) {
      return this.src.next(tgt, this.action);
    }
  }

  /**
   * Node with retry capabilities
   * @class
   * @extends BaseNode
   */
  class Node extends BaseNode {
    /**
     * Creates a new Node instance
     * @param {number} [maxRetries=1] - Maximum number of retry attempts
     * @param {number} [wait=0] - Wait time between retries (seconds)
     */
    constructor(maxRetries = 1, wait = 0) {
      super();

      /**
       * Maximum number of retry attempts
       * @type {number}
       */
      this.maxRetries = maxRetries;

      /**
       * Wait time between retries (seconds)
       * @type {number}
       */
      this.wait = wait;

      /**
       * Current retry attempt (set during execution)
       * @type {number}
       */
      this.curRetry = 0;
    }

    /**
     * Fallback execution handler for when all retries fail
     * @param {*} prepRes - Result from the prep phase
     * @param {Error} exc - The exception that caused the failure
     * @returns {*} Fallback result
     * @throws {Error} The original exception by default
     */
    execFallback(prepRes, exc) {
      throw exc;
    }

    /**
     * Internal execution method with retry logic
     * @param {*} prepRes - Result from the prep phase
     * @returns {*} Execution result
     * @protected
     */
    _exec(prepRes) {
      for (this.curRetry = 0; this.curRetry < this.maxRetries; this.curRetry++) {
        try {
          return this.exec(prepRes);
        } catch (e) {
          if (this.curRetry === this.maxRetries - 1) {
            return this.execFallback(prepRes, e);
          }

          if (this.wait > 0) {
            warnings.warn("Synchronous wait in browser JS is not recommended. Consider using AsyncNode instead.");
            // Non-blocking wait (doesn't actually pause execution)
            setTimeout(() => { }, this.wait * 1000);
          }
        }
      }
    }
  }

  /**
   * Processes items in a batch
   * @class
   * @extends Node
   */
  class BatchNode extends Node {
    /**
     * Internal execution method that processes each item
     * @param {Array} items - Items to process
     * @returns {Array} Array of execution results
     * @protected
     */
    _exec(items) {
      if (!items) return [];
      if (!Array.isArray(items)) {
        warnings.warn("BatchNode expected an array but received " + typeof items);
        return [super._exec(items)];
      }
      return items.map(item => super._exec(item));
    }
  }

  /**
   * Orchestrates node execution
   * @class
   * @extends BaseNode
   */
  class Flow extends BaseNode {
    /**
     * Creates a new Flow instance
     * @param {BaseNode} [startNode=null] - The starting node
     */
    constructor(startNode = null) {
      super();

      /**
       * The starting node for this flow
       * @type {BaseNode}
       */
      this.startNode = startNode;
    }

    /**
     * Sets the starting node for this flow
     * @param {BaseNode} startNode - The starting node
     * @returns {BaseNode} The starting node (for chaining)
     */
    start(startNode) {
      if (!(startNode instanceof BaseNode)) {
        throw new TypeError("Start node must be a BaseNode instance");
      }
      this.startNode = startNode;
      return startNode;
    }

    /**
     * Gets the next node based on the current node and action
     * @param {BaseNode} curr - Current node
     * @param {string} action - Action name
     * @returns {BaseNode|null} The next node or null if not found
     */
    getNextNode(curr, action) {
      const nextAction = action || "default";
      const next = curr.successors[nextAction];

      if (!next && Object.keys(curr.successors).length > 0) {
        warnings.warn(`Flow ends: '${nextAction}' not found in ${JSON.stringify(Object.keys(curr.successors))}`);
      }

      return next;
    }

    /**
     * Orchestrates node execution through the flow
     * @param {Object} shared - Shared context object
     * @param {Object} [params=null] - Parameters to pass to nodes
     * @returns {*} Final execution result
     * @protected
     */
    _orchestrate(shared, params = null) {
      if (!this.startNode) {
        warnings.warn("Flow has no start node");
        return null;
      }

      let curr = this.startNode;
      let p = params || { ...this.params };
      let lastAction = null;

      while (curr) {
        // Create a shallow copy of the current node to avoid side effects
        const currentNode = shallowCopy(curr);
        currentNode.setParams(p);
        lastAction = currentNode._run(shared);
        curr = this.getNextNode(curr, lastAction);
      }

      return lastAction;
    }

    /**
     * Internal run method that orchestrates the flow execution
     * @param {Object} shared - Shared context object
     * @returns {*} Result of flow execution
     * @protected
     */
    _run(shared) {
      const p = this.prep(shared);
      const o = this._orchestrate(shared);
      return this.post(shared, p, o);
    }
  }

  /**
   * Processes multiple parameter sets through a flow
   * @class
   * @extends Flow
   */
  class BatchFlow extends Flow {
    /**
     * Internal run method that processes each parameter set
     * @param {Object} shared - Shared context object
     * @returns {*} Result of batch flow execution
     * @protected
     */
    _run(shared) {
      const pr = this.prep(shared) || [];

      if (!Array.isArray(pr)) {
        warnings.warn("BatchFlow expected an array from prep() but received " + typeof pr);
        return this.post(shared, pr, null);
      }

      for (const bp of pr) {
        this._orchestrate(shared, { ...this.params, ...bp });
      }

      return this.post(shared, pr, null);
    }
  }

  /**
   * Asynchronous node with retry capabilities
   * @class
   * @extends Node
   */
  class AsyncNode extends Node {
    /**
     * Asynchronous preparation phase
     * @param {Object} shared - Shared context object
     * @returns {Promise<*>} Promise resolving to preparation result
     */
    async prepAsync(shared) {
      return null;
    }

    /**
     * Asynchronous execution phase
     * @param {*} prepRes - Result from the prepAsync phase
     * @returns {Promise<*>} Promise resolving to execution result
     */
    async execAsync(prepRes) {
      return null;
    }

    /**
     * Asynchronous fallback execution handler
     * @param {*} prepRes - Result from the prepAsync phase
     * @param {Error} exc - The exception that caused the failure
     * @returns {Promise<*>} Promise resolving to fallback result
     * @throws {Error} The original exception by default
     */
    async execFallbackAsync(prepRes, exc) {
      throw exc;
    }

    /**
     * Asynchronous post-processing phase
     * @param {Object} shared - Shared context object
     * @param {*} prepRes - Result from the prepAsync phase
     * @param {*} execRes - Result from the execAsync phase
     * @returns {Promise<*>} Promise resolving to final result
     */
    async postAsync(shared, prepRes, execRes) {
      return execRes;
    }

    /**
     * Internal asynchronous execution method with retry logic
     * @param {*} prepRes - Result from the prepAsync phase
     * @returns {Promise<*>} Promise resolving to execution result
     * @protected
     */
    async _exec(prepRes) {
      for (this.curRetry = 0; this.curRetry < this.maxRetries; this.curRetry++) {
        try {
          return await this.execAsync(prepRes);
        } catch (e) {
          if (this.curRetry === this.maxRetries - 1) {
            return await this.execFallbackAsync(prepRes, e);
          }

          if (this.wait > 0) {
            await new Promise(resolve => setTimeout(resolve, this.wait * 1000));
          }
        }
      }
    }

    /**
     * Asynchronously executes this node
     * @param {Object} shared - Shared context object
     * @returns {Promise<*>} Promise resolving to execution result
     */
    async runAsync(shared) {
      if (Object.keys(this.successors).length > 0) {
        warnings.warn("Node won't run successors. Use AsyncFlow.");
      }
      return await this._runAsync(shared);
    }

    /**
     * Internal asynchronous run method
     * @param {Object} shared - Shared context object
     * @returns {Promise<*>} Promise resolving to execution result
     * @protected
     */
    async _runAsync(shared) {
      const p_res = await this.prepAsync(shared);
      const e_res = await this._exec(p_res); // _exec internally calls execAsync
      const post_res = await this.postAsync(shared, p_res, e_res);
      return post_res;
    }

    /**
     * Overridden to prevent synchronous execution
     * @throws {Error} Always throws an error
     * @protected
     */
    _run(shared) {
      throw new Error("AsyncNode cannot be run synchronously. Use runAsync().");
    }
  }

  /**
   * Utility for implementing mixin pattern
   * @param {Function} derivedCtor - Derived class constructor
   * @param {Function[]} baseCtors - Base class constructors to mix in
   * @private
   */
  function applyMixins(derivedCtor, baseCtors) {
    baseCtors.forEach(baseCtor => {
      Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
        // Only add if the method doesn't already exist on the derived prototype
        if (name !== 'constructor' && !Object.prototype.hasOwnProperty.call(derivedCtor.prototype, name)) {
          Object.defineProperty(
            derivedCtor.prototype,
            name,
            Object.getOwnPropertyDescriptor(baseCtor.prototype, name)
          );
        }
      });
    });
  }

  /**
   * Asynchronous node that processes items in a batch (sequentially)
   * @class
   * @extends AsyncNode
   */
  class AsyncBatchNode extends AsyncNode {
    /**
     * Creates a new AsyncBatchNode instance
     * @param {number} [maxRetries=1] - Maximum number of retry attempts
     * @param {number} [wait=0] - Wait time between retries (seconds)
     */
    constructor(maxRetries = 1, wait = 0) {
      super(maxRetries, wait);

      /**
       * BatchNode implementation for delegation
       * @type {BatchNode}
       * @private
       */
      this._batchImpl = new BatchNode(maxRetries, wait);
    }

    /**
     * Internal asynchronous execution method that processes each item sequentially
     * @param {Array} items - Items to process
     * @returns {Promise<Array>} Promise resolving to array of execution results
     * @protected
     */
    async _exec(items) {
      if (!items) return [];

      if (!Array.isArray(items)) {
        warnings.warn("AsyncBatchNode expected an array but received " + typeof items);
        return [await super._exec(items)];
      }

      const results = [];
      for (const item of items) {
        results.push(await super._exec(item));
      }
      return results;
    }
  }

  /**
   * Asynchronous node that processes items in a batch (in parallel)
   * @class
   * @extends AsyncNode
   */
  class AsyncParallelBatchNode extends AsyncNode {
    /**
     * Internal asynchronous execution method that processes all items in parallel
     * @param {Array} items - Items to process
     * @returns {Promise<Array>} Promise resolving to array of execution results
     * @protected
     */
    async _exec(items) {
      if (!items) return [];

      if (!Array.isArray(items)) {
        warnings.warn("AsyncParallelBatchNode expected an array but received " + typeof items);
        return [await super._exec(items)];
      }

      return await Promise.all(items.map(item => super._exec(item)));
    }
  }

  /**
   * Asynchronous flow orchestrator
   * @class
   * @extends Flow
   * @mixes AsyncNode
   */
  class AsyncFlow extends Flow {
    /**
     * Creates a new AsyncFlow instance
     * @param {BaseNode} [startNode=null] - The starting node
     */
    constructor(startNode = null) {
      super(startNode);

      /**
       * Current retry attempt (set during execution)
       * @type {number}
       */
      this.curRetry = 0;

      /**
       * Maximum number of retry attempts
       * @type {number}
       */
      this.maxRetries = 1;

      /**
       * Wait time between retries (seconds)
       * @type {number}
       */
      this.wait = 0;
    }

    /**
     * Asynchronous preparation phase
     * @param {Object} shared - Shared context object
     * @returns {Promise<*>} Promise resolving to preparation result
     */
    async prepAsync(shared) {
      return null;
    }

    /**
     * Asynchronous post-processing phase
     * @param {Object} shared - Shared context object
     * @param {*} prepRes - Result from the prepAsync phase
     * @param {*} execRes - Result from execution
     * @returns {Promise<*>} Promise resolving to final result
     */
    async postAsync(shared, prepRes, execRes) {
      return execRes;
    }

    /**
     * Asynchronously orchestrates node execution through the flow
     * @param {Object} shared - Shared context object
     * @param {Object} [params=null] - Parameters to pass to nodes
     * @returns {Promise<*>} Promise resolving to final execution result
     * @protected
     */
    async _orchestrateAsync(shared, params = null) {
      if (!this.startNode) {
        warnings.warn("AsyncFlow has no start node");
        return null;
      }

      let curr = this.startNode;
      let p = params || { ...this.params };
      let lastAction = null;

      while (curr) {
        // Create a shallow copy of the current node to avoid side effects
        const currentNode = shallowCopy(curr);
        currentNode.setParams(p);

        if (currentNode instanceof AsyncNode) {
          lastAction = await currentNode._runAsync(shared);
        } else {
          lastAction = currentNode._run(shared);
        }

        curr = this.getNextNode(curr, lastAction);
      }

      return lastAction;
    }

    /**
     * Internal asynchronous run method
     * @param {Object} shared - Shared context object
     * @returns {Promise<*>} Promise resolving to execution result
     * @protected
     */
    async _runAsync(shared) {
      const p = await this.prepAsync(shared);
      const o = await this._orchestrateAsync(shared);
      return await this.postAsync(shared, p, o);
    }

    /**
     * Asynchronously executes this flow
     * @param {Object} shared - Shared context object
     * @returns {Promise<*>} Promise resolving to execution result
     */
    async runAsync(shared) {
      return await this._runAsync(shared);
    }
  }

  /**
   * Asynchronous flow that processes multiple parameter sets (sequentially)
   * @class
   * @extends AsyncFlow
   */
  class AsyncBatchFlow extends AsyncFlow {
    /**
     * Internal asynchronous run method that processes each parameter set sequentially
     * @param {Object} shared - Shared context object
     * @returns {Promise<*>} Promise resolving to batch execution result
     * @protected
     */
    async _runAsync(shared) {
      const pr = await this.prepAsync(shared) || [];

      if (!Array.isArray(pr)) {
        warnings.warn("AsyncBatchFlow expected an array from prepAsync() but received " + typeof pr);
        return await this.postAsync(shared, pr, null);
      }

      for (const bp of pr) {
        await this._orchestrateAsync(shared, { ...this.params, ...bp });
      }

      return await this.postAsync(shared, pr, null);
    }
  }

  /**
   * Asynchronous flow that processes multiple parameter sets (in parallel)
   * @class
   * @extends AsyncFlow
   */
  class AsyncParallelBatchFlow extends AsyncFlow {
    /**
     * Internal asynchronous run method that processes all parameter sets in parallel
     * @param {Object} shared - Shared context object
     * @returns {Promise<*>} Promise resolving to batch execution result
     * @protected
     */
    async _runAsync(shared) {
      const pr = await this.prepAsync(shared) || [];

      if (!Array.isArray(pr)) {
        warnings.warn("AsyncParallelBatchFlow expected an array from prepAsync() but received " + typeof pr);
        return await this.postAsync(shared, pr, null);
      }

      await Promise.all(pr.map(bp =>
        this._orchestrateAsync(shared, { ...this.params, ...bp })
      ));

      return await this.postAsync(shared, pr, null);
    }
  }

  // Apply AsyncNode methods to AsyncFlow
  applyMixins(AsyncFlow, [AsyncNode]);

  // Export public API
  const publicAPI = {
    BaseNode,
    Node,
    BatchNode,
    Flow,
    BatchFlow,
    AsyncNode,
    AsyncBatchNode,
    AsyncParallelBatchNode,
    AsyncFlow,
    AsyncBatchFlow,
    AsyncParallelBatchFlow,
    ConditionalTransition,

    /**
     * Utility functions
     */
    utils: {
      /**
       * Add a warning handler
       * @param {Function} handler - Warning handler function
       */
      addWarningHandler: warnings.addHandler.bind(warnings),

      /**
       * Clear all warning handlers
       */
      clearWarningHandlers: warnings.clearHandlers.bind(warnings),

      /**
       * Create a deep copy of an object
       * @param {*} obj - Object to copy
       * @returns {*} Deep copy of the object
       */
      deepCopy: deepCopy
    },

    /**
     * Framework version
     * @type {string}
     */
    VERSION: '1.0.0'
  };

  return publicAPI;
})();

// Make it available globally in browsers
if (typeof window !== 'undefined') {
  window.FlowFramework = FlowFramework;
}

// Support CommonJS modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FlowFramework;
}

// Support ES modules
if (typeof exports !== 'undefined') {
  Object.assign(exports, FlowFramework);
}
