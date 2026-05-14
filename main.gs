function onOpen(e) {
  FormApp.getUi()
    .createAddonMenu()
    .addItem('Open Auditor', 'showSidebar')
    .addToUi();
}

function onInstall(e) {
  onOpen(e);
}

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('sidebar')
    .setTitle('AI Survey Auditor')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  FormApp.getUi().showSidebar(html);
}

function getSettings() {
  var props = PropertiesService.getUserProperties();
  return {
    provider: props.getProperty('provider') || 'openai',
    baseUrl: props.getProperty('baseUrl') || 'https://api.openai.com/v1/chat/completions',
    model: props.getProperty('model') || 'gpt-4o',
    hasApiKey: !!props.getProperty('apiKey')
  };
}

function saveSettings(settings) {
  var props = PropertiesService.getUserProperties();
  props.setProperty('provider', settings.provider);
  props.setProperty('baseUrl', settings.baseUrl);
  props.setProperty('model', settings.model);
  if (settings.apiKey) {
    props.setProperty('apiKey', settings.apiKey);
  }
  return { success: true };
}

function runAudit() {
  var formJson = extractFormLogic();
  if (!formJson || formJson.length === 0) {
    return { error: 'No questions found in this form.' };
  }
  return analyzeForm(formJson);
}

function extractFormJson() {
  return extractFormLogic();
}