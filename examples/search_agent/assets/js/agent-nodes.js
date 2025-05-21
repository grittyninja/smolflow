/**
 * @file agent-nodes.js
 * @description Defines the SмолFlow nodes for the search agent.
 */

/**
 * @global FlowFramework
 */

/**
 * Parses the YAML-like string response from the LLM to extract decision components.
 * Relies on a specific format:
 * ```yaml
 * thinking: |
 *   <...>
 * action: search OR answer
 * reason: <...>
 * answer: <if action is answer>
 * search_query: <specific search query if action is search>
 * ```
 * This is a simplified parser and might be fragile if the LLM output deviates significantly.
 * @param {string} responseText - The raw text response from the LLM.
 * @returns {object|null} An object with `thinking`, `action`, `reason`, `answer`, `search_query`, or null if parsing fails.
 */
function parseLLMDecision(responseText) {
  if (!responseText || typeof responseText !== 'string') {
    console.error('Invalid responseText to parse:', responseText);
    return null;
  }

  const decision = {
    thinking: '',
    action: '',
    reason: '',
    answer: '',
    search_query: '',
  };

  try {
    // Attempt to find the YAML block first
    const yamlMatch = responseText.match(/```yaml\s*([\s\S]*?)\s*```/);
    const contentToParse = yamlMatch ? yamlMatch[1].trim() : responseText.trim();

    // Extract thinking (multi-line)
    const thinkingMatch = contentToParse.match(/thinking:\s*\|?\s*([\s\S]*?)(?=\n\w+:|$)/);
    if (thinkingMatch && thinkingMatch[1]) {
      decision.thinking = thinkingMatch[1].trim().replace(/^\s*-\s*/gm, ''); // Clean up list markers if any
    }

    // Extract action
    const actionMatch = contentToParse.match(/action:\s*(\w+)/);
    if (actionMatch && actionMatch[1]) {
      decision.action = actionMatch[1].trim();
    }

    // Extract reason (can be multi-line with | or single line)
    const reasonMatch = contentToParse.match(/reason:\s*\|?\s*([\s\S]*?)(?=\n\w+:|$)/);
    if (reasonMatch && reasonMatch[1]) {
      decision.reason = reasonMatch[1].trim();
    }
    
    // Extract answer (if action is answer, can be multi-line)
    const answerMatch = contentToParse.match(/answer:\s*\|?\s*([\s\S]*?)(?=\n\w+:|$)/);
    if (answerMatch && answerMatch[1]) {
      decision.answer = answerMatch[1].trim();
    }

    // Extract search_query (if action is search)
    const searchQueryMatch = contentToParse.match(/search_query:\s*(.+)/);
    if (searchQueryMatch && searchQueryMatch[1]) {
      decision.search_query = searchQueryMatch[1].trim();
    }

    // Basic validation
    if (!decision.action || (decision.action === 'search' && !decision.search_query) || (decision.action === 'answer' && !decision.answer && !decision.thinking)) {
       // If action is answer but no direct answer, there should at least be thinking.
       // This is a weak validation, LLM might just provide thinking and action: answer.
       // The prompt should guide it to provide an answer if action is answer.
      console.warn('LLM decision parsing might be incomplete:', decision, "Original:", contentToParse);
      // Don't return null for this, let the flow decide if it's usable.
    }

    // If action is 'answer', ensure search_query is empty, overriding any LLM mistake here.
    if (decision.action === 'answer') {
      decision.search_query = '';
    }
    
    return decision;

  } catch (error) {
    console.error('Error parsing LLM decision:', error, "Response Text:", responseText);
    return null; // Indicate parsing failure
  }
}


/**
 * @class DecideActionNode
 * @extends FlowFramework.AsyncNode
 * @description Node that calls an LLM to decide the next action (search or answer).
 */
class DecideActionNode extends FlowFramework.AsyncNode {
  constructor(maxRetries = 1, wait = 0) {
    super(maxRetries, wait);
  }

  /**
   * Prepares input for the LLM decision.
   * @param {object} shared - The shared context object.
   * @returns {Promise<object>} Resolves with question and context.
   */
  async prepAsync(shared) {
    UIManager.updateProgressStepper('DECIDING');
    UIManager.addLogEntry({ type: 'STATUS_MESSAGE', content: 'Agent is deciding the next action...' });
    
    let maxAttempts = 3; // Default
    if (typeof shared.maxSearchAttempts === 'number' && shared.maxSearchAttempts > 0) {
      maxAttempts = shared.maxSearchAttempts;
    }

    return {
      question: shared.question,
      context: shared.context || "No previous research.",
      llmConfig: shared.llmConfig, // Passed from app.js
      apiServices: shared.apiServices, // Passed from app.js
      searchAttempts: shared.searchAttempts || 0,
      maxSearchAttempts: maxAttempts
    };
  }

  /**
   * Executes the LLM call to decide the action.
   * @param {object} prepRes - Result from prepAsync.
   * @param {string} prepRes.question - The user's question.
   * @param {string} prepRes.context - The current research context.
   * @param {object} prepRes.llmConfig - LLM configuration.
   * @param {object} prepRes.apiServices - API services instance.
   * @param {number} prepRes.searchAttempts - Current number of search attempts.
   * @param {number} prepRes.maxSearchAttempts - Maximum allowed search attempts.
   * @returns {Promise<object|null>} Resolves with the parsed decision object or null on error.
   */
  async execAsync({ question, context, llmConfig, apiServices, searchAttempts, maxSearchAttempts }) {
    const currentTime = new Date().toLocaleString();

    if (searchAttempts >= maxSearchAttempts) {
      // Force answer if max search attempts reached
      const forcedAnswerDecision = {
        thinking: `Maximum search attempts (${maxSearchAttempts}) reached. Attempting to answer with available information.`,
        action: 'answer',
        reason: `Forced to answer due to reaching the maximum number of search attempts.`,
        answer: `After ${maxSearchAttempts} search attempts, I could not find a definitive answer with high confidence. Based on the information gathered: ${context.substring(context.lastIndexOf("RESULTS:") + 8)}`, // Try to use last search results
        search_query: ''
      };
      // If context is very short (e.g. "No previous research."), provide a more generic forced answer.
      if ((context || "").length < 100) {
        forcedAnswerDecision.answer = `After ${maxSearchAttempts} search attempts, I could not find a definitive answer with high confidence. Please try rephrasing your question or check external sources.`;
      }
      UIManager.addLogEntry({ type: 'STATUS_MESSAGE', content: `Max search attempts reached. Forcing answer.` });
      return forcedAnswerDecision;
    }

    const prompt = `
Current Time: ${currentTime}
Search attempts made so far: ${searchAttempts} (max ${maxSearchAttempts})

### CONTEXT
You are an intelligent research assistant. Your primary goal is to answer the user's question accurately and efficiently using the information available in "Previous Research & Search Results".
Question: ${question}
Previous Research & Search Results:
${context}

### GUIDELINES FOR DECISION MAKING (CRITICAL)
1.  **PRIORITIZE ANSWERING**: Your default action should be 'answer' if the "Previous Research & Search Results" provide a reasonable basis to do so. Only choose 'search' if the information is clearly insufficient or critically outdated for the given question.
2.  **ASSESS SUFFICIENCY & CONFIDENCE**:
    *   After each search (if any), critically evaluate if the newly added information, combined with previous results, is now sufficient.
    *   If the question is straightforward (e.g., "What is the capital of France?", "Who is the current president of Indonesia?"), and a reliable source in the search results provides a clear answer, you should be confident to 'answer' immediately. Do not perform additional searches for widely known facts if a good source is found.
    *   If you have high confidence in the available information, choose 'answer'.
3.  **EFFICIENT SEARCH STRATEGY (If searching is absolutely necessary)**:
    *   Formulate concise, effective queries. Avoid overly specific queries with dates unless essential and confirmed. General queries first, then more specific if needed.
    *   Aim to gather enough information within ${maxSearchAttempts} search attempts.
    *   If current_search_attempts is ${searchAttempts} and this is >= ${maxSearchAttempts - 1} (i.e., this is the last or second to last allowed search), make an extra effort to synthesize an answer in the next step unless the information is completely absent or contradictory.
4.  **AVOID UNNECESSARY SEARCHES**: Do not search if:
    *   The answer is already evident in the context.
    *   The question is subjective and doesn't require factual lookup.
    *   You have performed ${maxSearchAttempts} searches already (you MUST 'answer' or indicate inability if context is still poor).

### ACTION SPACE
[1] search
  Description: Perform a web search. Use this SPARINGLY and only if the current context is critically insufficient and you are not confident enough to answer.
  Parameters:
    - query (str): A well-formulated, effective search query designed to obtain the missing critical information.

[2] answer
  Description: Provide the answer based on the "Previous Research & Search Results". Choose this if you have reasonable confidence or if search attempts are exhausted.
  Parameters:
    - answer (str): The final, comprehensive answer. If there's still some uncertainty due to limited/conflicting info after searching, clearly state the answer and then briefly qualify it (e.g., "Based on available information from [source type]...").

## NEXT ACTION
Based on your critical analysis of the "Previous Research & Search Results" and the guidelines above, decide the next action.
Return your response in this EXACT YAML format:
\`\`\`yaml
thinking: |
  My detailed step-by-step reasoning:
  1. Assessment of current information sufficiency for the question "${question}".
  2. Confidence level in answering directly (High/Medium/Low).
  3. Justification for choosing 'search' or 'answer'. If searching, why is it absolutely necessary and how does the new query improve upon previous ones (if any)? If answering, which parts of the context support the answer?
action: search OR answer
reason: |
  A brief, concise explanation for why this action was chosen over the other.
search_query: If action is 'search', provide the specific search query here. Else, leave empty.
answer: |
  If action is 'answer', provide the comprehensive answer here. Else, leave empty.
\`\`\`
IMPORTANT:
1. Adhere strictly to the YAML format.
2. Your 'action' MUST be either 'search' or 'answer'.
3. If 'action' is 'search', 'search_query' MUST be filled.
4. If 'action' is 'answer', 'answer' MUST be filled.
5. 'thinking' and 'reason' MUST always be provided.
6. If search_attempts (${searchAttempts}) is equal to or greater than max_search_attempts (${maxSearchAttempts}), you MUST choose 'answer'.
`;

    try {
      const responseText = await apiServices.callLLM({
        baseUrl: llmConfig.baseUrl,
        apiKey: llmConfig.apiKey,
        model: llmConfig.model,
        messages: [{ role: 'user', content: prompt }],
      });
      const decision = parseLLMDecision(responseText);
      if (!decision || !decision.action) {
        throw new Error('Failed to parse LLM decision or action is missing.');
      }
      return decision;
    } catch (error) {
      console.error('Error in DecideActionNode execAsync:', error);
      UIManager.addLogEntry({ type: 'ERROR_MESSAGE', content: `Error deciding action: ${error.message}` });
      UIManager.updateProgressStepper('ERROR');
      throw error; 
    }
  }

  /**
   * Processes the LLM decision and updates shared context.
   * @param {object} shared - The shared context object.
   * @param {object} prepRes - Result from prepAsync.
   * @param {object} execRes - The parsed decision from execAsync.
   * @returns {Promise<string|null>} Resolves with the action ('search', 'answer') or null if error.
   */
  async postAsync(shared, prepRes, execRes) {
    if (!execRes || !execRes.action) {
      UIManager.addLogEntry({ type: 'ERROR_MESSAGE', content: 'LLM decision was invalid or could not be parsed.' });
      shared.currentStepKey = 'ERROR';
      return 'ERROR'; // Or a specific error action if your flow handles it
    }

    UIManager.addLogEntry({
      type: 'AGENT_DECISION',
      action: execRes.action,
      thinking: execRes.thinking,
      reason: execRes.reason,
      query: execRes.search_query,
      answer: execRes.answer
    });

    if (execRes.action === 'search') {
      if (!execRes.search_query) {
         UIManager.addLogEntry({ type: 'ERROR_MESSAGE', content: 'LLM decided to search but provided no query.' });
         shared.currentStepKey = 'ERROR';
         return 'ERROR';
      }
      shared.search_query = execRes.search_query;
      shared.currentStepKey = 'SEARCHING';
      return 'search';
    } else if (execRes.action === 'answer') {
      if (!execRes.answer) {
        UIManager.addLogEntry({ type: 'STATUS_MESSAGE', content: 'LLM decided to answer but provided no direct answer text. Using thinking as context for now.' });
        shared.context = `${shared.context}\n\nASSISTANT THINKING (leading to answer):\n${execRes.thinking}`;
        // This might need refinement based on how AnswerQuestionNode uses context
      } else {
        shared.context = execRes.answer; // The answer itself becomes the new context for AnswerQuestionNode
      }
      shared.final_answer_from_decision = execRes.answer; // Store direct answer if provided
      shared.currentStepKey = 'ANSWERING'; // Or 'DONE' if we consider this the final answer
      return 'answer';
    } else {
      UIManager.addLogEntry({ type: 'ERROR_MESSAGE', content: `Unknown action from LLM: ${execRes.action}` });
      shared.currentStepKey = 'ERROR';
      return 'ERROR';
    }
  }
}

/**
 * @class SearchWebNode
 * @extends FlowFramework.AsyncNode
 * @description Node that performs a web search using Brave Search.
 */
class SearchWebNode extends FlowFramework.AsyncNode {
  constructor(maxRetries = 1, wait = 0) {
    super(maxRetries, wait);
  }

  /**
   * Prepares the search query.
   * @param {object} shared - The shared context object.
   * @returns {Promise<object>} Resolves with search query, API key, and services.
   */
  async prepAsync(shared) {
    UIManager.updateProgressStepper('SEARCHING');
    UIManager.addLogEntry({ type: 'AGENT_SEARCH', query: shared.search_query });
    return {
      search_query: shared.search_query,
      // braveApiKey is no longer needed here, proxy handles it.
      apiServices: shared.apiServices // Passed from app.js
    };
  }

  /**
   * Executes the web search.
   * @param {object} prepRes - Result from prepAsync.
   * @param {string} prepRes.search_query - The query to search for.
   * @param {object} prepRes.apiServices - API services instance.
   * @returns {Promise<string>} Resolves with formatted search results.
   */
  async execAsync({ search_query, apiServices }) { // braveApiKey removed from parameters
    try {
      const results = await apiServices.searchBrave({
        // apiKey: braveApiKey, // No longer sent from client
        query: search_query,
      });
      return results;
    } catch (error) {
      console.error('Error in SearchWebNode execAsync:', error);
      UIManager.addLogEntry({ type: 'ERROR_MESSAGE', content: `Error during web search: ${error.message}` });
      UIManager.updateProgressStepper('ERROR');
      // shared.currentStepKey = 'ERROR'; // Removed: This should be handled by the calling flow orchestrator
      throw error;
    }
  }

  /**
   * Processes search results and updates shared context.
   * @param {object} shared - The shared context object.
   * @param {object} prepRes - Result from prepAsync.
   * @param {string} execRes - Formatted search results from execAsync.
   * @returns {Promise<string>} Resolves with 'decide' to loop back.
   */
  async postAsync(shared, prepRes, execRes) {
    UIManager.addLogEntry({ type: 'AGENT_SEARCH_RESULTS', query: prepRes.search_query, results: execRes });
    shared.context = (shared.context || "") + `\n\nSEARCHED FOR: "${prepRes.search_query}"\nRESULTS:\n${execRes}`;
    shared.searchAttempts = (shared.searchAttempts || 0) + 1; // Increment search attempts
    shared.currentStepKey = 'DECIDING';
    return 'decide'; // Loop back to DecideActionNode
  }
}

/**
 * @class AnswerQuestionNode
 * @extends FlowFramework.AsyncNode
 * @description Node that calls an LLM to formulate a final answer based on context.
 */
class AnswerQuestionNode extends FlowFramework.AsyncNode {
  constructor(maxRetries = 1, wait = 0) {
    super(maxRetries, wait);
  }

  /**
   * Prepares question and context for the LLM.
   * @param {object} shared - The shared context object.
   * @returns {Promise<object>} Resolves with question, context, LLM config, and services.
   */
  async prepAsync(shared) {
    UIManager.updateProgressStepper('ANSWERING');
    UIManager.addLogEntry({ type: 'STATUS_MESSAGE', content: 'Agent is formulating the final answer...' });
    const isFinalAnswerAlreadyDecided = !!shared.final_answer_from_decision;
    return {
      question: shared.question,
      context: shared.final_answer_from_decision || shared.context, // Prioritize direct answer from DecideAction
      llmConfig: shared.llmConfig,
      apiServices: shared.apiServices,
      isFinalAnswerAlreadyDecided: isFinalAnswerAlreadyDecided // Pass flag
    };
  }

  /**
   * Executes the LLM call to generate the final answer.
   * @param {object} prepRes - Result from prepAsync.
   * @param {string} prepRes.question - The user's question.
   * @param {string} prepRes.context - The research context (or direct answer from decision).
   * @param {object} prepRes.llmConfig - LLM configuration.
   * @param {object} prepRes.apiServices - API services instance.
   * @param {boolean} prepRes.isFinalAnswerAlreadyDecided - Flag indicating if context is already the final answer.
   * @returns {Promise<string>} Resolves with the final answer.
   */
  async execAsync({ question, context, llmConfig, apiServices, isFinalAnswerAlreadyDecided }) {
    // If context already IS the answer (from DecideActionNode), just return it.
    if (isFinalAnswerAlreadyDecided) {
        return context; // This context is the final answer from DecideActionNode
    }

    const currentTime = new Date().toLocaleString();
    const prompt = `
Current Time: ${currentTime}

### CONTEXT
Based on the following information, provide a comprehensive and well-formatted answer to the question.
If the information is insufficient, clearly state that.

Question: ${question}

Research & Information:
${context}

## YOUR ANSWER:
Provide the final answer below.
`;
    try {
      const answer = await apiServices.callLLM({
        baseUrl: llmConfig.baseUrl,
        apiKey: llmConfig.apiKey,
        model: llmConfig.model,
        messages: [{ role: 'user', content: prompt }],
      });
      return answer;
    } catch (error) {
      console.error('Error in AnswerQuestionNode execAsync:', error);
      UIManager.addLogEntry({ type: 'ERROR_MESSAGE', content: `Error generating answer: ${error.message}` });
      UIManager.updateProgressStepper('ERROR');
      throw error;
    }
  }

  /**
   * Saves the final answer to shared context.
   * @param {object} shared - The shared context object.
   * @param {object} prepRes - Result from prepAsync.
   * @param {string} execRes - The final answer from execAsync.
   * @returns {Promise<string>} Resolves with 'done'.
   */
  async postAsync(shared, prepRes, execRes) {
    UIManager.addLogEntry({ type: 'AGENT_ANSWER', answer: execRes });
    shared.answer = execRes;
    shared.currentStepKey = 'DONE';
    UIManager.updateProgressStepper('DONE');
    return 'done';
  }
}

// Expose to global scope if not using modules
if (typeof window !== 'undefined') {
  window.DecideActionNode = DecideActionNode;
  window.SearchWebNode = SearchWebNode;
  window.AnswerQuestionNode = AnswerQuestionNode;
  window.parseLLMDecision = parseLLMDecision;
}
