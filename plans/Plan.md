# Project Specification: AI Survey Auditor (Google Workspace Add-on)

## 1. Project Overview

Build a Google Workspace Add-on for Google Forms. The add-on will live in the Google Forms sidebar. It extracts the active form's questions, options, and conditional routing logic, formats it into a structured JSON payload, and sends it to an LLM via a standard OpenAI-compatible API. The LLM returns an audit based on logical completeness (dead-ends), methodology bias ("Mom Test" principles), and edge-case coverage. The add-on supports OpenAI, OpenRouter, and local models (via tunneling).

## 2. Tech Stack & Architecture

* **Environment:** Google Apps Script (GAS)
* **UI Framework:** Google Workspace Card Service (UI built programmatically, no HTML/CSS)
* **Form Interaction:** Google Forms Service (`FormApp`)
* **External API:** `UrlFetchApp` using the standard OpenAI `chat/completions` API schema. This schema universally supports OpenAI, OpenRouter, and local inference servers (e.g., LM Studio, Ollama).
* **State Management:** `PropertiesService.getUserProperties()` for securely storing the user's API key, Base URL, and Model configuration.

## 3. Required File Structure

Generate the following modular files in the Apps Script project:

* `appsscript.json` (Manifest file with necessary OAuth scopes)
* `main.gs` (Entry point for the Add-on, `onOpen` triggers)
* `ui.gs` (All Card Service UI generation: Home card, Settings card, Results card)
* `extractor.gs` (Logic for parsing the Google Form into JSON)
* `llm.gs` (Logic for calling the external LLM API and handling the response)
* `utils.gs` (Helper functions, formatting, and error handling)

## 4. Data Model: Form Extraction Schema

The `extractor.gs` file must loop through all items in the active form and generate an array of objects representing the form's structure.
**Target JSON Structure:**

```json
[
  {
    "index": 1,
    "id": "12345",
    "type": "MULTIPLE_CHOICE",
    "title": "What is your age?",
    "helpText": "Select one.",
    "choices": [
      { "text": "Under 30", "navigation": "CONTINUE" },
      { "text": "30 or older", "navigation": "GO_TO_SECTION_3" }
    ]
  },
  {
    "index": 2,
    "type": "PAGE_BREAK",
    "title": "Section 2: Habits"
  }
]

```

## 5. Step-by-Step Implementation Guide for AI Agent

### Step 1: Setup and Manifest (`appsscript.json`)

* Create the manifest file.
* Required scopes:
* `https://www.googleapis.com/auth/forms.currentonly`
* `https://www.googleapis.com/auth/script.external_request`


* Set the add-on trigger to open in Forms.

### Step 2: UI Scaffolding & Configuration (`ui.gs` & `main.gs`)

* Create an `onOpen(e)` function returning a homepage card.
* **Home Card:** Must include a primary "Audit Survey Structure" button and a "Settings" button.
* **Settings Card:** Build a configuration form to save properties using `PropertiesService.getUserProperties().setProperty()`. Include:
1. **Provider Selection:** Dropdown (`CardService.newSelectionInput()`) with options: OpenAI, OpenRouter, Local/Custom.
2. **Base URL Input:** Text input field.
* Default for OpenAI: `https://api.openai.com/v1/chat/completions`
* Default for OpenRouter: `https://openrouter.ai/api/v1/chat/completions`
* Placeholder for Local: `https://your-ngrok-url.app/v1/chat/completions` (Include a text widget warning that local instances MUST be exposed via ngrok/Cloudflare, as GAS cannot fetch `localhost`).


3. **Model Name Input:** Text input field (e.g., `gpt-4o`, `anthropic/claude-3-haiku`, `local-model`).
4. **API Key Input:** Text input field (optional if using an unauthenticated local model).



### Step 3: The Extractor (`extractor.gs`)

* Write a function `extractFormLogic()`.
* Read items using `FormApp.getActiveForm().getItems()`.
* Use a switch statement to handle different `ItemTypes` (`MULTIPLE_CHOICE`, `LIST`, `CHECKBOX`, `PAGE_BREAK`, `PARAGRAPH_TEXT`).
* **Crucial Logic Check:** For choice-based items, extract routing logic using `choice.getPageNavigationType()` or `choice.getGotoPage().getTitle()`.

### Step 4: LLM Integration (`llm.gs`)

* Write a function `analyzeForm(formJson)`.
* Construct the `UrlFetchApp` request dynamically based on saved user properties.
* **Headers:**
* Always include: `'Content-Type': 'application/json'`
* If an API key exists: `'Authorization': 'Bearer ' + apiKey`
* If Provider == OpenRouter, add: `'HTTP-Referer': 'https://surveyauditor.local'` and `'X-Title': 'Survey Auditor'`.


* **Payload Construction:** Use standard OpenAI schema:
```json
{
  "model": "[dynamically inserted from settings]",
  "messages": [
    {"role": "system", "content": "You are an expert UX Researcher and Survey Auditor. Your output MUST be strictly valid JSON. Analyze the provided form JSON for: 1) Logic dead-ends or unhandled routing branches. 2) 'Mom Test' violations (leading questions, pitching disguised as questions, future-prediction questions). 3) Missing demographic edge cases (e.g., overlapping ranges)."},
    {"role": "user", "content": "[Insert Form JSON here]"}
  ],
  "response_format": { "type": "json_object" },
  "temperature": 0.2
}

```


* **Expected LLM Output Schema:** Ensure the system prompt commands the model to return this exact JSON structure: `{ "critical_errors": ["..."], "methodology_warnings": ["..."], "suggestions": ["..."] }`

### Step 5: Displaying Results (`ui.gs`)

* Write a function `buildResultsCard(llmResponse)`.
* Parse the JSON returned by the LLM.
* Map over the arrays and use `CardService.newTextParagraph()` and `CardService.newDecoratedText()` to display the results cleanly in the sidebar.
* Group the UI by:
* 🔴 **Critical Errors** (Logic breaks)
* 🟡 **Methodology Warnings** (Bias, Mom Test failures)
* 🟢 **Suggestions** (Missing edge cases)
* Include a "Back to Home" button