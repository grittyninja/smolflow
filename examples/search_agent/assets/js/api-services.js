/**
 * @file api-services.js
 * @description Handles all external API communications for the search agent.
 */

/**
 * Namespace for API service functions.
 * @namespace ApiServices
 */
const ApiServices = (() => {
  /**
   * Calls the configured LLM API.
   * @memberof ApiServices
   * @param {object} params - Parameters for the LLM call.
   * @param {string} params.baseUrl - The base URL of the LLM API.
   * @param {string} params.apiKey - The API key for the LLM.
   * @param {string} params.model - The LLM model to use (e.g., 'openai/gpt-4o').
   * @param {Array<object>} params.messages - The array of message objects for the chat completion.
   * @returns {Promise<string>} A promise that resolves to the LLM's response message content.
   * @throws {Error} If the API call fails or returns a non-OK status.
   * @example
   * ApiServices.callLLM({
   *   baseUrl: 'https://openrouter.ai/api/v1',
   *   apiKey: 'YOUR_API_KEY',
   *   model: 'openai/gpt-4o',
   *   messages: [{ role: 'user', content: 'Hello!' }]
   * }).then(response => console.log(response))
   *   .catch(error => console.error(error));
   */
  async function callLLM({ baseUrl, apiKey, model, messages }) {
    if (!baseUrl || !apiKey || !model || !messages) {
      throw new Error('Missing required parameters for LLM call.');
    }

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          model: model,
          messages: messages,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`LLM API request failed with status ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        return data.choices[0].message.content;
      } else {
        throw new Error('Invalid response structure from LLM API.');
      }
    } catch (error) {
      console.error('Error calling LLM API:', error);
      throw error; 
    }
  }

  /**
   * Searches the web using the local Brave Search CORS Proxy.
   * @memberof ApiServices
   * @param {object} params - Parameters for the search call.
   * @param {string} params.query - The search query.
   * @returns {Promise<string>} A promise that resolves to a formatted string of search results.
   * @throws {Error} If the API call fails or returns a non-OK status.
   * @example
   * ApiServices.searchBrave({
   *   query: 'latest AI news'
   * }).then(results => console.log(results))
   *   .catch(error => console.error(error));
   */
  async function searchBrave({ query }) { // apiKey parameter removed
    if (!query) {
      throw new Error('Missing required query parameter for Brave Search call via proxy.');
    }

    // URL points to the local proxy server
    const proxyUrl = `http://localhost:8787/search?q=${encodeURIComponent(query)}`;
    
    // Headers for the proxy request
    const currentConfig = ConfigManager.getConfig();
    const braveApiKey = currentConfig.braveApiKey;

    if (!braveApiKey) {
      console.error('Brave API Key is not set. Please configure it in settings.');
      throw new Error('Brave API Key is not configured. Please set it in the UI.');
    }

    const headers = {
      'Accept': 'application/json',
      'X-Brave-Api-Key': braveApiKey, // Send API key to our proxy
    };

    try {
      const response = await fetch(proxyUrl, { headers });

      if (!response.ok) {
        let errorBody = 'Could not retrieve error details.';
        try {
            errorBody = await response.text();
        } catch (e) {
            // ignore if can't read body
        }
        throw new Error(`Brave Search (via proxy) request failed with status ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      if (data.web && data.web.results && data.web.results.length > 0) {
        const config = ConfigManager.getConfig();
        const numResultsToTake = config.maxSearchResultsPerCall || 10; // Fallback to 10
        const topResults = data.web.results.slice(0, numResultsToTake);
        return topResults
          .map(r => `Title: ${r.title}\nURL: ${r.url}\nDescription: ${r.description || r.snippet || 'N/A'}`)
          .join('\n\n');
      } else if (data.web && data.web.results && data.web.results.length === 0) {
        return 'No results found for your query.';
      } else {
        console.warn('Unexpected response structure from Brave Search API:', data);
        return 'Could not parse search results.';
      }
    } catch (error) {
      console.error('Error calling Brave Search API:', error);
      throw error; // Re-throw to be caught by the caller
    }
  }

  return {
    callLLM,
    searchBrave,
  };
})();

// Expose to global scope
if (typeof window !== 'undefined') {
  window.ApiServices = ApiServices;
}
