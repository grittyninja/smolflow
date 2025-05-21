/**
 * @file config.js
 * @description Manages loading and saving of application configuration to/from localStorage.
 */

/**
 * Namespace for configuration management functions.
 * @namespace ConfigManager
 */
const ConfigManager = (() => {
  const CONFIG_KEY = 'searchAgentConfig';

  /**
   * Default configuration values.
   * @type {object}
   * @property {string} llmBaseUrl - The base URL for the LLM API.
   * @property {string} llmApiKey - The API key for the LLM.
   * @property {string} braveApiKey - The API key for Brave Search.
   * @property {string} llmModel - The LLM model to use.
   */
  const DEFAULTS = {
    llmBaseUrl: 'https://openrouter.ai/api/v1',
    llmApiKey: '',
    braveApiKey: '',
    llmModel: 'openai/gpt-4o', // Default model as per example
    apiCallRetryDelaySeconds: 5, // Default retry delay for API calls (node-level)
    maxApiRetries: 3, // Default max retries for a single failing API call (node-level)
    maxSearchResultsPerCall: 10, // Default number of search results to fetch from Brave API
    maxAgentSearchAttempts: 3, // Default max times the agent will decide to search
  };

  /**
   * Loads configuration from localStorage.
   * If no configuration is found, returns default values.
   * @memberof ConfigManager
   * @returns {object} The loaded or default configuration.
   * @example
   * const currentConfig = ConfigManager.loadConfig();
   */
  function loadConfig() {
    try {
      const storedConfig = localStorage.getItem(CONFIG_KEY);
      if (storedConfig) {
        return { ...DEFAULTS, ...JSON.parse(storedConfig) };
      }
    } catch (error) {
      console.error('Error loading config from localStorage:', error);
      // Fallback to defaults if parsing fails
    }
    return { ...DEFAULTS };
  }

  /**
   * Saves the provided configuration object to localStorage.
   * @memberof ConfigManager
   * @param {object} configObj - The configuration object to save.
   * @param {string} [configObj.llmBaseUrl] - The base URL for the LLM API.
   * @param {string} [configObj.llmApiKey] - The API key for the LLM.
   * @param {string} [configObj.braveApiKey] - The API key for Brave Search.
   * @param {string} [configObj.llmModel] - The LLM model to use.
   * @param {number} [configObj.apiCallRetryDelaySeconds] - Retry delay in seconds.
   * @param {number} [configObj.maxApiRetries] - Max retries for API calls.
   * @param {number} [configObj.maxSearchResultsPerCall] - Max search results to fetch.
   * @param {number} [configObj.maxAgentSearchAttempts] - Max times agent decides to search.
   * @example
   * ConfigManager.saveConfig({ llmApiKey: 'new_key', apiCallRetryDelaySeconds: 10, maxApiRetries: 2, maxSearchResultsPerCall: 7, maxAgentSearchAttempts: 2 });
   */
  function saveConfig(configObj) {
    try {
      const currentConfig = loadConfig();
      const newConfig = { ...currentConfig, ...configObj };
      localStorage.setItem(CONFIG_KEY, JSON.stringify(newConfig));
    } catch (error) {
      console.error('Error saving config to localStorage:', error);
    }
  }

  /**
   * Retrieves the current configuration. Alias for loadConfig.
   * @memberof ConfigManager
   * @returns {object} The current configuration.
   */
  function getConfig() {
    return loadConfig();
  }

  return {
    loadConfig,
    saveConfig,
    getConfig,
  };
})();

// Expose to global scope if not using modules, or handle exports if using modules.
if (typeof window !== 'undefined') {
  window.ConfigManager = ConfigManager;
}
