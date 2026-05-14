function getUserProperty(key) {
  return PropertiesService.getUserProperties().getProperty(key);
}

function setUserProperty(key, value) {
  PropertiesService.getUserProperties().setProperty(key, value);
}

function getActualBaseUrl(baseUrl) {
  if (!baseUrl) return '';
  if (baseUrl.indexOf('chat/completions') !== -1) return baseUrl;
  if (baseUrl.endsWith('/chat')) return baseUrl + '/completions';
  if (baseUrl.endsWith('/v1')) return baseUrl + '/chat/completions';
  if (baseUrl.endsWith('/')) return baseUrl + 'v1/chat/completions';
  return baseUrl + '/v1/chat/completions';
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}