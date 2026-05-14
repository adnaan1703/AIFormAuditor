function analyzeForm(formJson) {
  var model = getUserProperty('model');
  var baseUrl = getUserProperty('baseUrl');
  var apiKey = getUserProperty('apiKey');
  var provider = getUserProperty('provider') || 'openai';

  var actualUrl = getActualBaseUrl(baseUrl);

  var formJsonString = JSON.stringify(formJson);

  var systemPrompt = 'You are an expert UX Researcher and Survey Auditor. '
    + 'Analyze the provided form JSON for: '
    + '1) Logic dead-ends or unhandled routing branches. '
    + '2) "Mom Test" violations (leading questions, pitching disguised as questions, future-prediction questions). '
    + '3) Missing demographic edge cases (e.g., overlapping ranges). '
    + '4) Any other critical issues that would cause respondent confusion or data quality problems. '
    + '5) Methodology issues (e.g., leading questions, double-barreled questions, lack of neutral options). '
    + '6) Opportunities to improve question clarity, flow, or respondent engagement. '
    + '7) Grammatical errors or typos that could affect respondent understanding. '
    + 'Provide actionable suggestions to fix any issues you find. '
    + 'Your output MUST be purely JSON with no markdown, no code fences, no explanation text. '
    + 'Return EXACTLY this structure and nothing else: '
    + '{"critical_errors":["..."],"methodology_warnings":["..."],"suggestions":["..."]} '
    + 'Use empty arrays if no issues found in a category. '
    + 'Do NOT wrap the JSON in ``` or any other formatting. Only raw JSON.';
    + 'Double-check that your output is valid JSON and adheres EXACTLY to the specified structure.';

  var messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: formJsonString }
  ];

  var payload = {
    model: model,
    messages: messages,
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
    muteHttpExceptions: true
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
  var parsed = parseAuditResponse(content);

  if (!parsed) {
    throw new Error('Failed to parse LLM response as JSON. Raw response: ' + content.substring(0, 200));
  }

  return {
    critical_errors: parsed.critical_errors || [],
    methodology_warnings: parsed.methodology_warnings || [],
    suggestions: parsed.suggestions || []
  };
}

function parseAuditResponse(text) {
  var cleaned = text.trim();

  var parsed = tryParseJson(cleaned);
  if (parsed) return parsed;

  var codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    parsed = tryParseJson(codeBlockMatch[1].trim());
    if (parsed) return parsed;
  }

  var jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    var candidate = jsonMatch[0];

    parsed = tryParseJson(candidate);
    if (parsed) return parsed;

    parsed = tryParseJson(sanitizeJsonString(candidate));
    if (parsed) return parsed;
  }

  parsed = salvageAuditResponse(cleaned);
  if (parsed) return parsed;

  return null;
}

function sanitizeJsonString(str) {
  var fixed = str;
  fixed = fixed.replace(/\("([^)]*)"\)/g, function(match) {
    return match.replace(/"/g, '\\"');
  });
  fixed = fixed.replace(/,\s*""\s*\}/g, '}');
  fixed = fixed.replace(/,\s*\}/g, '}');
  fixed = fixed.replace(/,\s*\]/g, ']');
  return fixed;
}

function salvageAuditResponse(text) {
  var result = { critical_errors: [], methodology_warnings: [], suggestions: [] };
  var found = false;

  var criticalMatch = text.match(/"critical_errors"\s*:\s*(\[[^\]]*\])/);
  if (criticalMatch) {
    var arr = tryParseJson(criticalMatch[1]);
    if (arr) { result.critical_errors = arr; found = true; }
  }

  var warningMatch = text.match(/"methodology_warnings"\s*:\s*(\[[^\]]*\])/);
  if (warningMatch) {
    var arr = tryParseJson(warningMatch[1]);
    if (arr) { result.methodology_warnings = arr; found = true; }
  }

  var suggestionMatch = text.match(/"suggestions"\s*:\s*(\[[^\]]*\])/);
  if (suggestionMatch) {
    var arr = tryParseJson(suggestionMatch[1]);
    if (arr) { result.suggestions = arr; found = true; }
  }

  return found ? result : null;
}