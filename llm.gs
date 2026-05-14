function analyzeForm(formJson) {
  var model = getUserProperty('model');
  var baseUrl = getUserProperty('baseUrl');
  var apiKey = getUserProperty('apiKey');
  var provider = getUserProperty('provider') || 'openai';

  var actualUrl = getActualBaseUrl(baseUrl);

  var formJsonString = JSON.stringify(formJson);

  var systemPrompt = 'You are an expert UX Researcher and Survey Auditor. Your output MUST be strictly valid JSON. Analyze the provided form JSON for: 1) Logic dead-ends or unhandled routing branches. 2) "Mom Test" violations (leading questions, pitching disguised as questions, future-prediction questions). 3) Missing demographic edge cases (e.g., overlapping ranges). Return only this JSON structure: { "critical_errors": ["..."], "methodology_warnings": ["..."], "suggestions": ["..."] }. Use empty arrays if no issues found in a category.';

  var messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: formJsonString }
  ];

  var payload = {
    model: model,
    messages: messages,
    response_format: { type: 'json_object' },
    temperature: 0.2
  };

  var headers = {
    'Content-Type': 'application/json'
  };

  if (apiKey) {
    headers['Authorization'] = 'Bearer ' + apiKey;
  }

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://surveyauditor.local';
    headers['X-Title'] = 'Survey Auditor';
  }

  var options = {
    method: 'post',
    headers: headers,
    payload: JSON.stringify(payload),
    muteHttpExceptions: false
  };

  var response = UrlFetchApp.fetch(actualUrl, options);
  var responseCode = response.getResponseCode();
  var responseText = response.getContentText();

  if (responseCode !== 200) {
    var errorMsg = 'API returned status ' + responseCode;
    try {
      var errBody = JSON.parse(responseText);
      if (errBody.error && errBody.error.message) {
        errorMsg += ': ' + errBody.error.message;
      }
    } catch (e) {}
    throw new Error(errorMsg);
  }

  var responseData = JSON.parse(responseText);

  if (!responseData.choices || responseData.choices.length === 0) {
    throw new Error('LLM returned an empty response.');
  }

  var content = responseData.choices[0].message.content;

  var parsed = tryParseJson(content);
  if (!parsed) {
    var trimmed = content.trim();
    var jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = tryParseJson(jsonMatch[0]);
    }
  }

  if (!parsed) {
    throw new Error('Failed to parse LLM response as JSON.');
  }

  return {
    critical_errors: parsed.critical_errors || [],
    methodology_warnings: parsed.methodology_warnings || [],
    suggestions: parsed.suggestions || []
  };
}