/**
 * @file app.js
 * @description Main application logic for the SмолFlow Search Agent.
 */

/**
 * @global FlowFramework
 * @global ConfigManager
 * @global ApiServices
 * @global UIManager
 * @global DecideActionNode
 * @global SearchWebNode
 * @global AnswerQuestionNode
 */

document.addEventListener('DOMContentLoaded', () => {
  /**
   * Main application namespace.
   * @namespace App
   */
  const App = (() => {
    // Cache UIManager elements once
    const uiElementIds = {
      llmBaseUrlInput: 'llmBaseUrl',
      llmApiKeyInput: 'llmApiKey',
      llmModelInput: 'llmModel',
      braveApiKeyInput: 'braveApiKey',
      apiCallRetryDelaySecondsInput: 'apiCallRetryDelaySeconds', // Added
      maxApiRetriesInput: 'maxApiRetries', // Added
      maxSearchResultsPerCallInput: 'maxSearchResultsPerCall', // Added
      maxAgentSearchAttemptsInput: 'maxAgentSearchAttempts', // Added
      saveSettingsBtn: 'save-settings-btn',
      configStatus: 'config-status',
      questionInput: 'question-input',
      askQuestionBtn: 'ask-question-btn',
      progressStepper: 'progress-stepper',
      loadingIndicator: 'loading-indicator',
      logOutput: 'log-output',
      toggleConfigBtn: 'toggle-config-btn',
      configContent: 'config-content',
    };
    UIManager.init(uiElementIds);

    let currentAgentFlow = null;
    const shared = {}; // Shared context for the flow

    /**
     * Initializes the application: loads config, sets up event listeners.
     * @memberof App
     */
    function init() {
      loadAndDisplayConfig();
      setupEventListeners();
      UIManager.updateProgressStepper('IDLE');
      UIManager.showLoading(false);
    }

    /**
     * Loads configuration and displays it in the UI.
     * @memberof App
     */
    function loadAndDisplayConfig() {
      const config = ConfigManager.getConfig();
      UIManager.displayConfig(config);
    }

    /**
     * Sets up all event listeners for the application.
     * @memberof App
     */
    function setupEventListeners() {
      const elements = UIManager.getElements();

      if (elements.saveSettingsBtn) {
        elements.saveSettingsBtn.addEventListener('click', handleSaveSettings);
      }
      if (elements.askQuestionBtn) {
        elements.askQuestionBtn.addEventListener('click', handleAskQuestion);
      }
      if (elements.questionInput) {
        elements.questionInput.addEventListener('keypress', (event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); // Prevent new line
            handleAskQuestion();
          }
        });
      }
    }

    /**
     * Handles saving the configuration.
     * @memberof App
     */
    function handleSaveSettings() {
      const configValues = UIManager.getConfigInputValues();
      ConfigManager.saveConfig(configValues);
      UIManager.showConfigStatus('Settings saved successfully!', false);
    }

    /**
     * Creates and configures the agent flow.
     * @memberof App
     * @param {object} currentConfig - The current application configuration.
     * @returns {FlowFramework.AsyncFlow} The configured agent flow.
     */
    function createAgentFlow(currentConfig) {
      const nodeApiMaxRetries = parseInt(currentConfig.maxApiRetries, 10) || 3;
      const nodeApiRetryDelay = parseInt(currentConfig.apiCallRetryDelaySeconds, 10) || 5;

      const decideNode = new DecideActionNode(nodeApiMaxRetries, nodeApiRetryDelay);
      const searchNode = new SearchWebNode(nodeApiMaxRetries, nodeApiRetryDelay);
      const answerNode = new AnswerQuestionNode(nodeApiMaxRetries, nodeApiRetryDelay);

      // Set parameters for nodes - they will access these via this.params
      // Note: In smolflow.js, params are typically set on the node instance directly.
      // If nodes need access to shared config/services, it's often passed into `run` or `runAsync`
      // For this setup, we'll assume `shared` will carry these, or they are set via `setParams` if smolflow supports it per-node within a flow.
      // The current smolflow.js structure seems to pass params to the flow, which then might pass to nodes.
      // For simplicity, we'll add them to the `shared` object that `runAsync` receives.

      decideNode.next(searchNode, 'search');
      decideNode.next(answerNode, 'answer');
      searchNode.next(decideNode, 'decide');
      // answerNode is a terminal node for the 'done' action.

      const agentFlow = new FlowFramework.AsyncFlow(decideNode);
      return agentFlow;
    }

    /**
     * Handles the "Ask Question" button click.
     * Orchestrates the agent flow.
     * @memberof App
     * @async
     */
    async function handleAskQuestion() {
      const question = UIManager.getQuestion();
      if (!question) {
        UIManager.addLogEntry({ type: 'ERROR_MESSAGE', content: 'Please enter a question.' });
        return;
      }

      const config = ConfigManager.getConfig();
      if (!config.llmApiKey || !config.braveApiKey || !config.llmBaseUrl || !config.llmModel) {
        UIManager.addLogEntry({ type: 'ERROR_MESSAGE', content: 'LLM or Brave Search API settings are missing. Please configure them first.' });
        // Optionally, expand the config section
        const configBtn = UIManager.getElements().toggleConfigBtn;
        if (configBtn && configBtn.getAttribute('aria-expanded') === 'false') {
            configBtn.click();
        }
        return;
      }

      console.log('[App] handleAskQuestion started.');
      UIManager.clearLogs();
      UIManager.addLogEntry({ type: 'USER_QUESTION', content: question });
      UIManager.showLoading(true);
      UIManager.updateProgressStepper('IDLE'); // Will be updated by first node

      // Initialize shared context for this run
      shared.question = question;
      shared.context = "No previous research."; // Initial context
      shared.llmConfig = {
        baseUrl: config.llmBaseUrl,
        apiKey: config.llmApiKey,
        model: config.llmModel,
      };
      shared.braveApiKey = config.braveApiKey;
      shared.apiServices = ApiServices;
      shared.answer = null;
      shared.search_query = null;
      shared.currentStepKey = 'IDLE';
      shared.final_answer_from_decision = null;
      // Add new shared properties for agent search loop control
      shared.searchAttempts = 0; // Initialize current search attempts for this run
      shared.maxAgentSearchAttempts = parseInt(config.maxAgentSearchAttempts, 10) || 3; // Max times agent decides to search

      console.log('[App] Shared object before runAsync:', JSON.parse(JSON.stringify(shared))); // Deep copy for logging

      currentAgentFlow = createAgentFlow(config); // Pass full config

      try {
        console.log('[App] Attempting to run agent flow...');
        await currentAgentFlow.runAsync(shared);
        console.log('[App] Agent flow runAsync completed.');
        console.log('[App] Shared object after runAsync:', JSON.parse(JSON.stringify(shared)));


        // Final state after flow completion
        if (shared.answer) {
          UIManager.updateProgressStepper('DONE');
        } else if (shared.currentStepKey !== 'ERROR') {
          UIManager.addLogEntry({ type: 'STATUS_MESSAGE', content: 'Agent processing finished.' });
          // Corrected context check:
          if (typeof shared.context === 'string' && shared.context && shared.context !== "No previous research.") {
            UIManager.addLogEntry({ type: 'STATUS_MESSAGE', content: 'Final context: ' + shared.context });
          }
        }
      } catch (error) {
        console.error('[App] Error during agent flow execution:', error);
        console.log('[App] Shared object after error:', JSON.parse(JSON.stringify(shared)));
        UIManager.addLogEntry({ type: 'ERROR_MESSAGE', content: `An unexpected error occurred: ${error.message}` });
        UIManager.updateProgressStepper('ERROR');
      } finally {
        console.log('[App] Finally block reached. Shared.currentStepKey:', shared.currentStepKey);
        UIManager.showLoading(false);
      }
    }

    return {
      init,
    };
  })();

  App.init();
});
