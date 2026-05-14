function getUserProperty(key) {
  return PropertiesService.getUserProperties().getProperty(key);
}

function setUserProperty(key, value) {
  PropertiesService.getUserProperties().setProperty(key, value);
}

function getActualBaseUrl(baseUrl) {
  if (!baseUrl) return '';
  if (baseUrl.endsWith('/chat/completions')) return baseUrl;
  if (baseUrl.endsWith('/v1')) return baseUrl + '/chat/completions';
  if (baseUrl.endsWith('/')) return baseUrl + 'v1/chat/completions';
  return baseUrl + '/v1/chat/completions';
}

function showErrorToast(message) {
  CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification()
      .setText(message)
      .setType(CardService.NotificationType.ERROR))
    .build();
}

function showSuccessToast(message) {
  CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification()
      .setText(message))
    .build();
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function formatCountLabel(num) {
  return num + ' ' + (num === 1 ? 'issue' : 'issues') + ' found';
}