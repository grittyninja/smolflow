# SmolFlow Example: AI Search Agent

This example demonstrates a multi-step AI-powered search agent built using the SmolFlow framework. The agent takes a user's question, uses an LLM to decide if a web search is needed, performs the search using Brave Search API (if necessary), and then uses the LLM again to formulate an answer based on the question and search results.

![AI Search Agent Demo](../../static/demo-search-agent.gif)

This example is referenced in the main [SmolFlow README](../../README.md#example-application-ai-search-agent).

## Features

*   **LLM Integration**: Uses a Large Language Model (configurable, e.g., via OpenRouter) for:
    *   Deciding whether a web search is required to answer a question.
    *   Generating search queries.
    *   Formulating a final answer based on the initial question and search results.
*   **Web Search Capability**: Integrates with the Brave Search API to fetch real-time information from the web.
*   **Multi-Step Agent Logic**: Implements a flow:
    1.  **Decide**: LLM determines if a search is needed.
    2.  **Search**: If needed, LLM generates queries, and Brave Search API fetches results. This can loop a few times.
    3.  **Answer**: LLM synthesizes an answer using the gathered information.
*   **Interactive UI**:
    *   Configuration panel for API keys (LLM and Brave Search) and other settings.
    *   Input area for user questions.
    *   Progress display showing the agent's current state (Idle, Deciding, Searching, Answering, Done, Error).
    *   Log output detailing the agent's actions and thoughts.
*   **Configuration Management**: API keys and settings are configurable via the UI and saved to `localStorage`.
*   **Retry Mechanisms**: Implements retries for API calls.

## How it Works

The agent's logic is orchestrated by SmolFlow. Here's a breakdown of the key JavaScript files involved:

*   **`index.html`**: The main page that provides the UI for interacting with the agent.
*   **`assets/js/app.js`**:
    *   Initializes the application.
    *   Sets up the SmolFlow `AsyncFlow` and connects the different agent nodes.
    *   Handles user input and starts the agent flow.
*   **`assets/js/agent-nodes.js`**:
    *   Defines the custom SmolFlow `AsyncNode` classes that make up the agent:
        *   `InitialDecisionNode`: LLM decides if a search is needed.
        *   `QueryGenerationNode`: LLM generates search queries.
        *   `SearchWebNode`: Calls the Brave Search API via a local proxy (`simple_brave_proxy.js` in the root, if used).
        *   `AnsweringNode`: LLM generates the final answer.
        *   `ErrorNode`: Handles errors in the flow.
*   **`assets/js/api-services.js`**:
    *   Contains functions for making API calls to the LLM and the Brave Search API.
    *   Implements retry logic for these calls.
*   **`assets/js/config.js`**:
    *   Manages API keys, model names, and other operational settings.
    *   Provides functions to load and save configuration from/to `localStorage`.
*   **`assets/js/ui-manager.js`**:
    *   Handles all DOM manipulations, such as updating the progress stepper, displaying logs, and managing the configuration panel.
*   **`../../src/smolflow.js`**: The core SmolFlow framework library.
*   **`assets/css/style.css`**: Styles for the `index.html` page.

The agent uses a `shared` context object within SmolFlow to pass data between nodes, such as the original question, LLM decisions, generated queries, search results, and the final answer.

## Setup and Prerequisites

1.  **LLM Access**: You need access to an LLM that is compatible with the OpenAI API format.
    *   **Recommended**: Use [OpenRouter.ai](https://openrouter.ai/) which provides a unified interface to many models. You can get an API key from them.
    *   Set the **LLM Base URL** (e.g., `https://openrouter.ai/api/v1`) and your **LLM API Key** in the agent's settings UI.
    *   Specify the **LLM Model** (e.g., `openai/gpt-4o`, `anthropic/claude-3-haiku`, etc., depending on what your chosen base URL supports).
2.  **Brave Search API Key**: You need a Brave Search API key to allow the agent to perform web searches.
    *   You can get one from [Brave Search API](https://brave.com/search/api/).
    *   Set your **Brave Search API Key** in the agent's settings UI.
3.  **Optional: Local Proxy for Brave Search API**:
    *   The example is configured to use a local proxy (`simple_brave_proxy.js` located in the root directory of the SmolFlow project) to make calls to the Brave Search API. This is often necessary to bypass CORS restrictions when running `index.html` directly from the file system or a simple static server.
    *   To use it:
        1.  Ensure you have Node.js installed.
        2.  Open a terminal in the root directory of the SmolFlow project (where `simple_brave_proxy.js` is).
        3.  Run the proxy: `node simple_brave_proxy.js`
        4.  The proxy will typically run on `http://localhost:3000`. The `api-services.js` file is pre-configured to use this address for Brave Search calls.

## Running the Example

1.  **Start the Optional Proxy (if needed)**: As described above.
2.  **Open `index.html`**: Navigate to `examples/search_agent/index.html` and open it in a modern web browser.
3.  **Configure Settings**:
    *   Click the "Settings" button to expand the configuration panel.
    *   Enter your LLM Base URL, LLM API Key, LLM Model, and Brave Search API Key.
    *   Adjust any advanced settings if desired.
    *   Click "Save Settings". The settings will be saved in your browser's `localStorage`.
4.  **Ask a Question**:
    *   Type your question into the text area.
    *   Click the "Ask Question" button.
5.  **Observe**:
    *   The "Agent Progress" stepper will show the current stage of the agent.
    *   The "Agent Log" will display detailed information about the agent's actions, decisions, API calls, and any errors.

## SmolFlow Concepts Demonstrated

This example showcases several key features of the SmolFlow framework:

*   **`AsyncNode`**: All custom agent nodes (`InitialDecisionNode`, `SearchWebNode`, etc.) extend `AsyncNode` to perform asynchronous operations like API calls.
*   **`AsyncFlow`**: The main `app.js` script creates an `AsyncFlow` instance to orchestrate the sequence of these asynchronous nodes.
*   **Shared Context (`shared` object)**: The `shared` object is used extensively to pass:
    *   The user's question.
    *   Configuration settings.
    *   LLM decisions and generated content (e.g., search queries).
    *   Search results from Brave Search.
    *   The final answer.
    *   Error information.
*   **Conditional Transitions**: The flow of the agent is dynamic. For example:
    *   The `InitialDecisionNode`'s `postAsync` method returns an action string that determines whether to proceed to query generation/searching or directly to answering (if no search is deemed necessary).
    *   The search loop might terminate early if sufficient information is found or if the maximum search attempts are reached.
*   **Modularity**: Each step of the agent's process (deciding, searching, answering) is encapsulated in its own node, promoting separation of concerns.
*   **Retry Logic**: While not explicitly part of SmolFlow's node-level retry in this example's core nodes (as API retries are handled in `api-services.js`), the `AsyncNode`'s built-in retry capabilities could be used directly within nodes if desired. The `api-services.js` demonstrates a common pattern of handling retries at the service call level.
*   **Error Handling in a Flow**: The `ErrorNode` demonstrates a way to centralize error display within the flow.

By examining `app.js` and `agent-nodes.js`, you can see how these SmolFlow concepts are applied to build a functional, multi-step agent.
