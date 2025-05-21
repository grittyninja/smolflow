/**
 * @file ui-manager.js
 * @description Manages all DOM manipulations and UI updates for the search agent.
 */

/**
 * Namespace for UI management functions.
 * @namespace UIManager
 */
const UIManager = (() => {
  /**
   * @typedef {object} UIElements
   * @property {HTMLElement} llmBaseUrlInput - Input for LLM base URL.
   * @property {HTMLElement} llmApiKeyInput - Input for LLM API key.
   * @property {HTMLElement} llmModelInput - Input for LLM Model.
   * @property {HTMLElement} braveApiKeyInput - Input for Brave API key.
   * @property {HTMLElement} apiCallRetryDelaySecondsInput - Input for API call retry delay.
   * @property {HTMLElement} maxApiRetriesInput - Input for max API retries.
   * @property {HTMLElement} maxSearchResultsPerCallInput - Input for max search results per call.
   * @property {HTMLElement} maxAgentSearchAttemptsInput - Input for max agent search attempts.
   * @property {HTMLElement} saveSettingsBtn - Button to save settings.
   * @property {HTMLElement} configStatus - Paragraph to show config status messages.
   * @property {HTMLElement} questionInput - Textarea for user's question.
   * @property {HTMLElement} askQuestionBtn - Button to submit the question.
   * @property {HTMLElement} progressStepper - Container for progress steps.
   * @property {HTMLElement} loadingIndicator - Element to show loading state.
   * @property {HTMLElement} logOutput - Container for log entries.
   * @property {HTMLElement} toggleConfigBtn - Button to toggle config section visibility.
   * @property {HTMLElement} configContent - The content div of the collapsible config section.
   */

  /** @type {UIElements} */
  let elements = {};

  const STEP_KEYS = ['IDLE', 'DECIDING', 'SEARCHING', 'ANSWERING', 'DONE', 'ERROR'];

  /**
   * Initializes the UIManager by caching DOM elements.
   * Must be called once when the application starts.
   * @memberof UIManager
   * @param {object} elementIds - An object mapping keys to DOM element IDs.
   * @example
   * UIManager.init({
   *   llmBaseUrlInput: 'llmBaseUrl',
   *   // ... other elements
   * });
   */
  function init(elementIds) {
    for (const key in elementIds) {
      elements[key] = document.getElementById(elementIds[key]);
      if (!elements[key]) {
        console.warn(`UI element not found for ID: ${elementIds[key]}`);
      }
    }
    _initCollapsibleConfig();
  }

  /**
   * Initializes the collapsible configuration section.
   * @private
   */
  function _initCollapsibleConfig() {
    if (elements.toggleConfigBtn && elements.configContent) {
      elements.toggleConfigBtn.addEventListener('click', () => {
        const isCurrentlyExpanded = elements.toggleConfigBtn.getAttribute('aria-expanded') === 'true';
        const newExpandedState = !isCurrentlyExpanded;

        elements.toggleConfigBtn.setAttribute('aria-expanded', String(newExpandedState));
        elements.configContent.setAttribute('aria-hidden', String(!newExpandedState));

        if (newExpandedState) {
          // Expanding
          elements.configContent.classList.add('active'); // Add active for padding transitions
          elements.configContent.style.maxHeight = elements.configContent.scrollHeight + "px";
        } else {
          // Collapsing
          elements.configContent.style.maxHeight = '0';
          elements.configContent.classList.remove('active'); // Remove active to transition padding
        }
      });

      // Ensure it's initially collapsed by styles, JS confirms attributes
      elements.configContent.classList.remove('active'); // Ensure no 'active' class initially
      elements.configContent.style.maxHeight = '0'; // Explicitly set max-height to 0
      elements.configContent.setAttribute('aria-hidden', 'true');
      elements.toggleConfigBtn.setAttribute('aria-expanded', 'false');
    }
  }


  /**
   * Displays the given configuration values in the settings form.
   * @memberof UIManager
   * @param {object} configObj - The configuration object.
   * @param {string} configObj.llmBaseUrl - LLM base URL.
   * @param {string} configObj.llmApiKey - LLM API key.
   * @param {string} configObj.llmModel - LLM Model.
   * @param {string} configObj.braveApiKey - Brave API key.
   * @param {number} configObj.apiCallRetryDelaySeconds - API call retry delay.
   * @param {number} configObj.maxApiRetries - Max API retries.
   * @param {number} configObj.maxSearchResultsPerCall - Max search results per call.
   * @param {number} configObj.maxAgentSearchAttempts - Max agent search attempts.
   */
  function displayConfig(configObj) {
    if (elements.llmBaseUrlInput) elements.llmBaseUrlInput.value = configObj.llmBaseUrl || '';
    if (elements.llmApiKeyInput) elements.llmApiKeyInput.value = configObj.llmApiKey || '';
    if (elements.llmModelInput) elements.llmModelInput.value = configObj.llmModel || '';
    if (elements.braveApiKeyInput) elements.braveApiKeyInput.value = configObj.braveApiKey || '';
    if (elements.apiCallRetryDelaySecondsInput) elements.apiCallRetryDelaySecondsInput.value = configObj.apiCallRetryDelaySeconds ?? ConfigManager.DEFAULTS.apiCallRetryDelaySeconds;
    if (elements.maxApiRetriesInput) elements.maxApiRetriesInput.value = configObj.maxApiRetries ?? ConfigManager.DEFAULTS.maxApiRetries;
    if (elements.maxSearchResultsPerCallInput) elements.maxSearchResultsPerCallInput.value = configObj.maxSearchResultsPerCall ?? ConfigManager.DEFAULTS.maxSearchResultsPerCall;
    if (elements.maxAgentSearchAttemptsInput) elements.maxAgentSearchAttemptsInput.value = configObj.maxAgentSearchAttempts ?? ConfigManager.DEFAULTS.maxAgentSearchAttempts;
  }

  /**
   * Retrieves the current values from the configuration input fields.
   * @memberof UIManager
   * @returns {object} An object containing the configuration values.
   */
  function getConfigInputValues() {
    // Helper to parse integer or return undefined if not a valid number string
    const parseIntOrUndefined = (value) => {
        const num = parseInt(value, 10);
        return isNaN(num) ? undefined : num;
    };
    return {
      llmBaseUrl: elements.llmBaseUrlInput?.value.trim() || undefined,
      llmApiKey: elements.llmApiKeyInput?.value.trim() || undefined, // Keep empty strings as is, let config save handle it
      llmModel: elements.llmModelInput?.value.trim() || undefined,
      braveApiKey: elements.braveApiKeyInput?.value.trim() || undefined,
      apiCallRetryDelaySeconds: parseIntOrUndefined(elements.apiCallRetryDelaySecondsInput?.value),
      maxApiRetries: parseIntOrUndefined(elements.maxApiRetriesInput?.value),
      maxSearchResultsPerCall: parseIntOrUndefined(elements.maxSearchResultsPerCallInput?.value),
      maxAgentSearchAttempts: parseIntOrUndefined(elements.maxAgentSearchAttemptsInput?.value),
    };
  }

  /**
   * Displays a status message for configuration saving.
   * @memberof UIManager
   * @param {string} message - The message to display.
   * @param {boolean} [isError=false] - True if the message is an error.
   */
  function showConfigStatus(message, isError = false) {
    if (elements.configStatus) {
      elements.configStatus.textContent = message;
      elements.configStatus.className = `status-message ${isError ? 'error' : 'success'}`;
      setTimeout(() => {
        elements.configStatus.textContent = '';
        elements.configStatus.className = 'status-message';
      }, 3000);
    }
  }

  /**
   * Updates the visual progress stepper.
   * @memberof UIManager
   * @param {string} currentStepKey - The key of the current active step (e.g., 'DECIDING').
   */
  function updateProgressStepper(currentStepKey) {
    if (!elements.progressStepper) return;
    const steps = elements.progressStepper.querySelectorAll('.step');
    let stepFound = false;
    steps.forEach(step => {
      const stepKey = step.dataset.stepKey;
      step.classList.remove('active', 'completed');
      if (stepKey === currentStepKey) {
        step.classList.add('active');
        stepFound = true;
      } else if (!stepFound) {
        step.classList.add('completed'); // Mark previous steps as completed
      }
    });
  }

  /**
   * Adds a log entry to the output area.
   * @memberof UIManager
   * @param {object} logData - Data for the log entry.
   * @param {'USER_QUESTION'|'AGENT_DECISION'|'AGENT_SEARCH'|'AGENT_SEARCH_RESULTS'|'AGENT_ANSWER'|'ERROR_MESSAGE'|'STATUS_MESSAGE'} logData.type - The type of log entry.
   * @param {string} [logData.content] - General content for the log.
   * @param {string} [logData.thinking] - Agent's thinking process.
   * @param {string} [logData.action] - Agent's chosen action.
   * @param {string} [logData.query] - Search query.
   * @param {string} [logData.results] - Search results.
   * @param {string} [logData.answer] - Final answer.
   * @param {string} [logData.reason] - Reason for action.
   */
  function addLogEntry(logData) {
    if (!elements.logOutput) return;

    const entryDiv = document.createElement('div');
    entryDiv.classList.add('log-entry', logData.type.toLowerCase().replace(/_/g, '-'));

    let htmlContent = '';

    switch (logData.type) {
      case 'USER_QUESTION':
        htmlContent = `<p><strong>You asked:</strong></p><p>${escapeHtml(logData.content)}</p>`;
        break;
      case 'AGENT_DECISION':
        htmlContent = `<p><strong>Agent Decision:</strong> ${escapeHtml(logData.action)}</p>`;
        if (logData.reason) htmlContent += `<p><strong>Reason:</strong> ${escapeHtml(logData.reason)}</p>`;
        if (logData.thinking) htmlContent += `<p><strong>Thinking:</strong></p><pre>${escapeHtml(logData.thinking)}</pre>`;
        if (logData.query) htmlContent += `<p><strong>Search Query:</strong> ${escapeHtml(logData.query)}</p>`;
        if (logData.answer) htmlContent += `<p><strong>Direct Answer:</strong></p><pre>${escapeHtml(logData.answer)}</pre>`;
        break;
      case 'AGENT_SEARCH':
        htmlContent = `<p><strong>Agent Searching:</strong></p><p>Query: ${escapeHtml(logData.query)}</p>`;
        break;
      case 'AGENT_SEARCH_RESULTS':
        htmlContent = `<p><strong>Search Results for ${escapeHtml(logData.query)}:</strong></p><pre>${escapeHtml(logData.results)}</pre>`;
        break;
      case 'AGENT_ANSWER':
        htmlContent = `<p><strong>Final Answer:</strong></p><pre>${escapeHtml(logData.answer)}</pre>`;
        break;
      case 'ERROR_MESSAGE':
        htmlContent = `<p>${escapeHtml(logData.content)}</p>`;
        break;
      case 'STATUS_MESSAGE':
        htmlContent = `<p><em>${escapeHtml(logData.content)}</em></p>`;
        break;
      default:
        htmlContent = `<p>${escapeHtml(logData.content || JSON.stringify(logData))}</p>`;
    }

    entryDiv.innerHTML = htmlContent;
    elements.logOutput.appendChild(entryDiv);
    elements.logOutput.scrollTop = elements.logOutput.scrollHeight; // Auto-scroll
  }

  /**
   * Clears all entries from the log output area.
   * @memberof UIManager
   */
  function clearLogs() {
    if (elements.logOutput) {
      elements.logOutput.innerHTML = '';
    }
  }

  /**
   * Shows or hides the loading indicator and disables/enables the ask button.
   * @memberof UIManager
   * @param {boolean} isLoading - True to show loading, false to hide.
   */
  function showLoading(isLoading) {
    if (elements.loadingIndicator) {
      elements.loadingIndicator.classList.toggle('hidden', !isLoading);
    }
    if (elements.askQuestionBtn) {
      elements.askQuestionBtn.disabled = isLoading;
    }
  }

  /**
   * Gets the current question from the input field.
   * @memberof UIManager
   * @returns {string} The question text.
   */
  function getQuestion() {
    return elements.questionInput?.value.trim() || '';
  }

  /**
   * Clears the question input field.
   * @memberof UIManager
   */
  function clearQuestionInput() {
    if(elements.questionInput) elements.questionInput.value = '';
  }

  /**
   * Escapes HTML special characters to prevent XSS.
   * @param {string} str - The string to escape.
   * @returns {string} The escaped string.
   */
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  return {
    init,
    displayConfig,
    getConfigInputValues,
    showConfigStatus,
    updateProgressStepper,
    addLogEntry,
    clearLogs,
    showLoading,
    getQuestion,
    clearQuestionInput,
    // Expose for app.js to use
    getElements: () => elements,
  };
})();

// Expose to global scope
if (typeof window !== 'undefined') {
  window.UIManager = UIManager;
}
