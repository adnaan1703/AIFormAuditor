# FormAuditAI Improvement Plan - HTML Sidebar Version

## 0. Important Correction

The implementation should use the older Google Forms editor add-on model with Apps Script HTML Service, not Card Service.

Google Forms editor add-ons can use custom menus, dialogs, and sidebars built with standard HTML and CSS. The UI should be opened with `FormApp.getUi().showSidebar(htmlOutput)` and the sidebar should communicate with server-side Apps Script using `google.script.run`.

Do not build the UI with `CardService` unless the project is intentionally being migrated to a Google Workspace add-on surface that supports card-based UI. For this product, keep the HTML sidebar approach because it was already validated during testing.

## 1. Updated Product Direction

Upgrade FormAuditAI from a read-only Google Forms auditor into a Google Forms quality checker and repair assistant.

The product should:

1. Open inside the Google Forms editor as an HTML sidebar.
2. Extract the active form using `FormApp`.
3. Send a normalized form JSON payload to the configured LLM endpoint.
4. Show audit results in a rich HTML sidebar UI.
5. Let users preview and apply selected safe fixes.
6. Never silently edit the form.
7. Re-audit after changes.

## 2. Updated Architecture

Replace the previous Card Service UI assumption with HTML files.

Recommended Apps Script file structure:

```text
appsscript.json
Code.gs
main.gs
extractor.gs
llm.gs
patcher.gs
state.gs
utils.gs
Sidebar.html
SidebarJs.html
Styles.html
Settings.html optional
```

Alternative naming is fine, but keep the separation between server-side `.gs` logic and client-side HTML/CSS/JS.

## 3. File Responsibilities

### main.gs or Code.gs

Entry points and UI launch functions.

Required functions:

```javascript
function onOpen(e) {}
function onInstall(e) {}
function showSidebar() {}
function include(filename) {}
```

Example:

```javascript
function onOpen(e) {
  FormApp.getUi()
    .createAddonMenu()
    .addItem('Open FormAuditAI', 'showSidebar')
    .addToUi();
}

function onInstall(e) {
  onOpen(e);
}

function showSidebar() {
  const html = HtmlService
    .createTemplateFromFile('Sidebar')
    .evaluate()
    .setTitle('FormAuditAI');

  FormApp.getUi().showSidebar(html);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
```

### Sidebar.html

Main HTML shell.

Should contain:

- root app container
- template includes for CSS and JS
- initial loading state
- buttons and sections rendered by client-side JS

Example structure:

```html
<!DOCTYPE html>
<html>
  <head>
    <base target="_top">
    <?!= include('Styles'); ?>
  </head>
  <body>
    <div id="app"></div>
    <?!= include('SidebarJs'); ?>
  </body>
</html>
```

### SidebarJs.html

Client-side app logic.

Responsibilities:

- render screens
- call server functions with `google.script.run`
- show loading states
- handle errors
- store local UI state
- render audit results
- render patch previews
- trigger patch application

### Styles.html

All sidebar CSS.

Use simple responsive styling for a 300px sidebar.

### extractor.gs

Extract active form into normalized JSON.

### llm.gs

Build prompt, call provider, validate JSON.

### patcher.gs

Apply approved safe patches with `FormApp`.

### state.gs

Store last audit result and patches.

### utils.gs

Shared helpers.

## 4. Client-Server Flow

The HTML sidebar should call server-side Apps Script functions using `google.script.run`.

Example client-side call:

```javascript
function runAudit() {
  setLoading('Auditing form...');

  const context = getContextFromUi();

  google.script.run
    .withSuccessHandler(function(result) {
      window.appState.auditResult = result;
      renderAuditResult(result);
    })
    .withFailureHandler(function(error) {
      renderError(error && error.message ? error.message : String(error));
    })
    .runAudit(context);
}
```

Server-side function:

```javascript
function runAudit(context) {
  const formJson = extractActiveForm();
  const auditResult = callLlmForAudit(formJson, context);
  const auditId = saveAuditResult(auditResult, formJson);

  auditResult.audit_id = auditId;
  return auditResult;
}
```

## 5. Updated Manifest Requirements

Use an editor add-on style manifest. Keep the UI-related scope.

Recommended scopes:

```json
{
  "timeZone": "Asia/Kolkata",
  "runtimeVersion": "V8",
  "exceptionLogging": "STACKDRIVER",
  "oauthScopes": [
    "https://www.googleapis.com/auth/forms.currentonly",
    "https://www.googleapis.com/auth/script.container.ui",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.storage"
  ]
}
```

Notes:

- `forms.currentonly` is preferred for active-form access.
- `script.container.ui` is needed for custom sidebar/dialog UI.
- `script.external_request` is needed for `UrlFetchApp` provider calls.
- `script.storage` is needed if storing provider settings in PropertiesService.

## 6. Form Extraction Schema

Upgrade extraction to include IDs, indexes, types, titles, help text, required status, choices, sections, and routing metadata where available.

Recommended schema:

```json
{
  "form": {
    "title": "Customer Discovery Survey",
    "description": "...",
    "item_count": 12,
    "is_quiz": false
  },
  "sections": [
    {
      "section_index": 0,
      "title": "Start",
      "start_item_index": 0,
      "item_ids": ["12345", "67890"]
    }
  ],
  "items": [
    {
      "index": 0,
      "id": "12345",
      "type": "MULTIPLE_CHOICE",
      "section_index": 0,
      "title": "What is your age?",
      "help_text": "",
      "required": true,
      "choices": [
        {
          "index": 0,
          "text": "Under 30",
          "navigation_type": "CONTINUE",
          "goto_item_id": null,
          "goto_section_title": null
        },
        {
          "index": 1,
          "text": "30 or older",
          "navigation_type": "CONTINUE",
          "goto_item_id": null,
          "goto_section_title": null
        }
      ],
      "has_other_option": false
    }
  ],
  "limitations": []
}
```

## 7. LLM Output Schema

Use structured JSON so the UI can render issues and patches.

```json
{
  "summary": {
    "readiness": "needs_revision",
    "overall_score": 58,
    "one_line_summary": "The form has serious logic and Mom Test issues."
  },
  "critical_errors": [
    {
      "id": "issue_001",
      "question_id": "12345",
      "question_index": 3,
      "title": "Unhandled respondent segment",
      "issue": "The choice '30 or older' creates a segment, but no later question handles this group.",
      "why_it_matters": "This may produce incomplete data for an important respondent group.",
      "recommended_fix": "Add a follow-up section for respondents aged 30 or older.",
      "risk": "high",
      "patch_ids": ["patch_001"]
    }
  ],
  "methodology_warnings": [],
  "suggestions": [],
  "patches": [
    {
      "patch_id": "patch_001",
      "issue_id": "issue_001",
      "risk": "high",
      "operation": "add_section_after",
      "target_item_id": "12345",
      "target_item_index": 3,
      "before": "No 30+ follow-up section exists.",
      "after": "Add a new follow-up section for respondents aged 30 or older.",
      "preview_text": "Create a follow-up section for respondents aged 30 or older.",
      "requires_confirmation": true,
      "payload": {
        "section_title": "Follow-up for respondents aged 30 or older",
        "new_questions": [
          {
            "type": "PARAGRAPH_TEXT",
            "title": "What challenges or needs are different for you compared with younger respondents?"
          }
        ]
      }
    }
  ]
}
```

## 8. Patch Types for MVP

Support these first:

```text
update_title
update_help_text
update_choice_values
show_other_option
set_required
add_text_question_after
add_paragraph_question_after
add_multiple_choice_question_after
add_section_after
```

Defer these:

```text
update_branching_logic
move_item
delete_item
split_question
full_form_rewrite
```

## 9. Risk Rules

Risk values:

```text
safe
low
medium
high
unsupported
```

Apply rules:

- Safe: allow preview and apply.
- Low: allow preview and apply.
- Medium: require explicit confirmation.
- High: show manual review warning; optionally allow only behind a feature flag.
- Unsupported: show recommendation only, no apply button.

## 10. HTML Sidebar UI Plan

Because this is HTML, the UI can be much richer than Card Service.

### Main Screens

Use client-side rendering with simple state.

Recommended screens:

```text
home
settings
audit_loading
audit_summary
issue_list
issue_detail
patch_preview
patch_success
error
```

### Sidebar Width Constraint

Google Apps Script sidebars are narrow, so design for approximately 300px width.

Use:

- compact cards
- short headings
- collapsible details
- sticky bottom action bar
- small badges
- progressive disclosure

## 11. HTML UI Ideas

### Home Screen

Show:

```text
FormAuditAI
Find broken logic, biased questions, and missing follow-ups before sending your form.

Current form:
Customer Discovery Survey
12 questions - 3 sections

Research goal
[textarea]

Target audience
[input]

Survey stage
[select]

Strictness
[select]

[Quick Audit]
[Deep Audit]
[Settings]
```

### Audit Summary Screen

Show compact summary:

```text
Needs revision
Score: 58/100

Critical: 2
Warnings: 6
Suggestions: 9

Top issue:
Q3 creates an age segment but no follow-up exists.

[View critical errors]
[View warnings]
[View suggestions]
[Available fixes]
[Re-audit]
```

### Issue List Screen

Issue card format:

```text
Critical
Q3 - Unhandled respondent segment
The answer '30 or older' has no follow-up.

[Details] [Preview fix]
```

### Issue Detail Screen

Show:

```text
Q3 - What is your age?

Problem
The choice '30 or older' creates a segment, but no later question handles this group.

Why it matters
Your results may miss needs from older respondents.

Recommended fix
Add a follow-up section for respondents aged 30 or older.

Risk: High

[Preview fix]
[Back]
```

### Patch Preview Screen

For text changes:

```text
Before
Is your age is above 30?

After
Are you above 30 years old?

Risk: Safe

[Apply fix]
[Cancel]
```

For structural changes:

```text
This fix changes form structure.
Review carefully before applying.

[Apply anyway]
[Cancel]
```

### Patch Success Screen

Show:

```text
Fix applied
Q2 title was updated.

[Re-audit form]
[Back to results]
```

### Settings Screen

Show:

```text
Provider
[OpenAI / OpenRouter / Custom]

Base URL
[input]

Model
[input]

API key
[password input]

Temperature
[input]

[Test connection]
[Save settings]
```

## 12. Better HTML UI Components

Implement reusable client-side render helpers:

```javascript
renderScreen(name, data)
renderHeader(title, subtitle)
renderBadge(label, type)
renderIssueCard(issue, category)
renderPatchPreview(patch)
renderLoading(message)
renderError(message, actions)
```

Recommended CSS classes:

```text
.app
.header
.card
.badge
.badge-critical
.badge-warning
.badge-suggestion
.score-ring
.button
.button-primary
.button-secondary
.button-danger
.muted
.divider
.sticky-footer
.textarea
.input
.select
.loading-spinner
```

## 13. UX Improvements Enabled by HTML

HTML lets you add UX improvements that Card Service would make harder:

1. Inline loading spinner.
2. Progress messages during audit.
3. Expand/collapse details.
4. Search/filter issues.
5. Filter by risk.
6. Copy suggested question text.
7. Side-by-side before/after blocks.
8. Sticky footer buttons.
9. Local UI state without rebuilding server cards.
10. Better CSS styling and spacing.

## 14. Client-Side State Shape

Use a simple global state object in SidebarJs.html.

```javascript
window.appState = {
  screen: 'home',
  settings: null,
  context: {},
  formSnapshot: null,
  auditResult: null,
  selectedCategory: null,
  selectedIssueId: null,
  selectedPatchId: null,
  loading: false,
  error: null
};
```

## 15. Server Functions Exposed to HTML

These functions can be called through `google.script.run`.

```javascript
function getInitialState() {}
function saveSettings(settings) {}
function testConnection(settings) {}
function runAudit(context) {}
function getLastAudit() {}
function getPatchPreview(auditId, patchId) {}
function applyPatch(auditId, patchId) {}
function applyAllSafePatches(auditId) {}
function clearLastAudit() {}
```

## 16. Patching Safety

Before applying any patch:

1. Re-open the active form.
2. Verify the target item exists.
3. Verify item type matches.
4. Verify current text still matches `before`, where available.
5. Verify form fingerprint has not changed significantly.
6. Reject stale patches.
7. Apply only supported operations.
8. Return a structured result to the UI.

Patch result schema:

```json
{
  "ok": true,
  "message": "Question title updated.",
  "patch_id": "patch_003",
  "should_reaudit": true
}
```

Error result schema:

```json
{
  "ok": false,
  "error_code": "FORM_CHANGED",
  "message": "The form changed after the audit. Please re-run the audit before applying this fix."
}
```

## 17. Error Handling in HTML UI

Handle:

```text
MISSING_API_KEY
INVALID_API_KEY
INVALID_BASE_URL
PROVIDER_TIMEOUT
RATE_LIMIT
INVALID_JSON_RESPONSE
NO_ACTIVE_FORM
PATCH_TARGET_MISSING
FORM_CHANGED
UNSUPPORTED_PATCH_TYPE
PERMISSION_ERROR
```

Render each error with:

- short explanation
- retry button when useful
- settings button when configuration-related
- re-audit button when form-state-related

## 18. Revised Implementation Order

### Phase 1: Align UI with HTML Sidebar

1. Remove CardService assumptions from code and plan.
2. Confirm `showSidebar()` uses HtmlService.
3. Create Sidebar.html, SidebarJs.html, and Styles.html.
4. Add client-side state and render functions.
5. Add settings screen.

### Phase 2: Improve Audit Quality

1. Upgrade extractor schema.
2. Add research context inputs.
3. Upgrade LLM prompt and output schema.
4. Validate LLM JSON.
5. Render summary and issue lists.

### Phase 3: Add Patch Preview

1. Add patches array to LLM output.
2. Store audit and patches in state.gs.
3. Add issue detail screen.
4. Add patch preview screen.
5. Show before/after and risk.

### Phase 4: Apply Safe Fixes

1. Implement patcher.gs.
2. Add update_title.
3. Add update_help_text.
4. Add show_other_option.
5. Add set_required.
6. Add form fingerprint validation.
7. Add patch success screen.

### Phase 5: Add Low-Risk Structural Fixes

1. Add text question after item.
2. Add paragraph question after item.
3. Add multiple choice question after item.
4. Add section after item.
5. Keep branching updates manual in this phase.

## 19. Coding Agent Instruction Update

Use this instruction to replace any Card Service instruction in the previous plan:

```text
Important implementation correction: This is a Google Forms editor add-on using Apps Script HTML Service, not Card Service. Do not use CardService classes or card navigation. Build the sidebar using HtmlService and open it with FormApp.getUi().showSidebar(htmlOutput). The client-side sidebar should use HTML, CSS, and JavaScript, and should call server-side Apps Script functions through google.script.run.
```

## 20. Final Recommendation

Keep the HTML sidebar implementation. It is the better fit for this product because:

1. It works in the Google Forms editor add-on model.
2. It supports richer UI than Card Service.
3. It allows better before/after previews.
4. It supports client-side state and filtering.
5. It was already validated during your implementation/testing phase.

