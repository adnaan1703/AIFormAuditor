function buildHomeCard() {
  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('AI Survey Auditor')
      .setImageUrl('https://www.gstatic.com/images/icons/material/system/1x/analytics_black_24dp.png')
      .setImageStyle(CardService.ImageStyle.SQUARE));

  var mainSection = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph()
      .setText('Audit your Google Form for logic dead-ends, methodology bias (Mom Test principles), and missing edge cases using AI.'));

  var buttonsSection = CardService.newCardSection()
    .addWidget(CardService.newTextButton()
      .setText('Audit Survey Structure')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setBackgroundColor('#1a73e8')
      .setOnClickAction(CardService.newAction()
        .setFunctionName('handleAuditClick')))
    .addWidget(CardService.newTextButton()
      .setText('Settings')
      .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
      .setOnClickAction(CardService.newAction()
        .setFunctionName('handleSettingsClick')));

  card.addSection(mainSection);
  card.addSection(buttonsSection);

  return card.build();
}

function handleAuditClick() {
  var apiKey = getUserProperty('apiKey');
  var baseUrl = getUserProperty('baseUrl');
  var model = getUserProperty('model');

  if (!baseUrl || !model) {
    var nav = CardService.newNavigation()
      .pushCard(buildSettingsCard());
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Please configure your LLM settings first.'))
      .setNavigation(nav)
      .build();
  }

  try {
    var formJson = extractFormLogic();
    if (!formJson || formJson.length === 0) {
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
          .setText('No questions found in this form.')
          .setType(CardService.NotificationType.ERROR))
        .build();
    }

    var llmResult = analyzeForm(formJson);
    var resultCard = buildResultsCard(llmResult);
    var nav = CardService.newNavigation().pushCard(resultCard);

    return CardService.newActionResponseBuilder()
      .setNavigation(nav)
      .build();
  } catch (e) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Error: ' + e.message)
        .setType(CardService.NotificationType.ERROR))
      .build();
  }
}

function handleSettingsClick() {
  var nav = CardService.newNavigation()
    .pushCard(buildSettingsCard());
  return CardService.newActionResponseBuilder()
    .setNavigation(nav)
    .build();
}

function buildSettingsCard() {
  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Settings')
      .setSubtitle('Configure your LLM connection'));

  var provider = getUserProperty('provider') || 'openai';
  var baseUrl = getUserProperty('baseUrl') || '';
  var model = getUserProperty('model') || '';
  var apiKey = getUserProperty('apiKey') || '';

  var providerSection = CardService.newCardSection()
    .setHeader('Provider Configuration')
    .addWidget(CardService.newSelectionInput()
      .setFieldName('provider')
      .setTitle('LLM Provider')
      .addItem('OpenAI', 'openai', provider === 'openai')
      .addItem('OpenRouter', 'openrouter', provider === 'openrouter')
      .addItem('Local / Custom', 'local', provider === 'local')
      .setOnChangeAction(CardService.newAction()
        .setFunctionName('handleProviderChange')));

  var defaultBaseUrl = '';
  if (provider === 'openai') {
    defaultBaseUrl = 'https://api.openai.com/v1/chat/completions';
  } else if (provider === 'openrouter') {
    defaultBaseUrl = 'https://openrouter.ai/api/v1/chat/completions';
  } else {
    defaultBaseUrl = 'https://your-ngrok-url.app/v1/chat/completions';
  }

  var urlSection = CardService.newCardSection()
    .setHeader('Endpoint')
    .addWidget(CardService.newTextInput()
      .setFieldName('baseUrl')
      .setTitle('Base URL')
      .setValue(baseUrl || defaultBaseUrl)
      .setHint('Full endpoint URL ending with /chat/completions'));

  if (provider === 'local') {
    urlSection.addWidget(CardService.newTextParagraph()
      .setText('Local instances MUST be exposed via ngrok, Cloudflare Tunnel, or similar. Google Apps Script cannot reach localhost.'));
  }

  var modelSection = CardService.newCardSection()
    .setHeader('Model')
    .addWidget(CardService.newTextInput()
      .setFieldName('model')
      .setTitle('Model Name')
      .setValue(model)
      .setHint('e.g. gpt-4o, anthropic/claude-3-haiku, local-model'));

  var apiSection = CardService.newCardSection()
    .setHeader('Authentication')
    .addWidget(CardService.newTextInput()
      .setFieldName('apiKey')
      .setTitle('API Key')
      .setValue(apiKey)
      .setHint('Optional for unauthenticated local models'));

  var buttonSection = CardService.newCardSection()
    .addWidget(CardService.newTextButton()
      .setText('Save Settings')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setBackgroundColor('#1a73e8')
      .setOnClickAction(CardService.newAction()
        .setFunctionName('handleSaveSettings')));

  card.addSection(providerSection);
  card.addSection(urlSection);
  card.addSection(modelSection);
  card.addSection(apiSection);
  card.addSection(buttonSection);

  return card.build();
}

function handleProviderChange(e) {
  var provider = e.formInput.provider;
  setUserProperty('provider', provider);

  var defaultUrl = '';
  if (provider === 'openai') {
    defaultUrl = 'https://api.openai.com/v1/chat/completions';
  } else if (provider === 'openrouter') {
    defaultUrl = 'https://openrouter.ai/api/v1/chat/completions';
  } else {
    defaultUrl = 'https://your-ngrok-url.app/v1/chat/completions';
  }

  setUserProperty('baseUrl', defaultUrl);

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(buildSettingsCard()))
    .build();
}

function handleSaveSettings(e) {
  var formInput = e.formInput;
  setUserProperty('provider', formInput.provider);
  setUserProperty('baseUrl', formInput.baseUrl);
  setUserProperty('model', formInput.model);
  setUserProperty('apiKey', formInput.apiKey || '');

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification()
      .setText('Settings saved successfully.'))
    .setNavigation(CardService.newNavigation().popCard())
    .build();
}

function buildResultsCard(llmResponse) {
  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Audit Results')
      .setSubtitle('AI-powered form analysis'));

  if (llmResponse.critical_errors && llmResponse.critical_errors.length > 0) {
    var criticalSection = CardService.newCardSection()
      .setHeader('Critical Errors (' + llmResponse.critical_errors.length + ')');

    llmResponse.critical_errors.forEach(function(error) {
      criticalSection.addWidget(CardService.newDecoratedText()
        .setTopLabel('')
        .setText(error)
        .setIconUrl('https://www.gstatic.com/images/icons/material/system/1x/error_red_24dp.png')
        .setWrapText(true));
    });

    card.addSection(criticalSection);
  }

  if (llmResponse.methodology_warnings && llmResponse.methodology_warnings.length > 0) {
    var warnSection = CardService.newCardSection()
      .setHeader('Methodology Warnings (' + llmResponse.methodology_warnings.length + ')');

    llmResponse.methodology_warnings.forEach(function(warning) {
      warnSection.addWidget(CardService.newDecoratedText()
        .setTopLabel('')
        .setText(warning)
        .setIconUrl('https://www.gstatic.com/images/icons/material/system/1x/warning_amber_24dp.png')
        .setWrapText(true));
    });

    card.addSection(warnSection);
  }

  if (llmResponse.suggestions && llmResponse.suggestions.length > 0) {
    var suggestionSection = CardService.newCardSection()
      .setHeader('Suggestions (' + llmResponse.suggestions.length + ')');

    llmResponse.suggestions.forEach(function(suggestion) {
      suggestionSection.addWidget(CardService.newDecoratedText()
        .setTopLabel('')
        .setText(suggestion)
        .setIconUrl('https://www.gstatic.com/images/icons/material/system/1x/lightbulb_outline_yellow_24dp.png')
        .setWrapText(true));
    });

    card.addSection(suggestionSection);
  }

  if ((!llmResponse.critical_errors || llmResponse.critical_errors.length === 0) &&
      (!llmResponse.methodology_warnings || llmResponse.methodology_warnings.length === 0) &&
      (!llmResponse.suggestions || llmResponse.suggestions.length === 0)) {
    card.addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph()
        .setText('No issues found. Your form looks good!')));
  }

  card.addSection(CardService.newCardSection()
    .addWidget(CardService.newTextButton()
      .setText('Back to Home')
      .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
      .setOnClickAction(CardService.newAction()
        .setFunctionName('handleBackToHome'))));

  return card.build();
}

function handleBackToHome() {
  var nav = CardService.newNavigation()
    .popToRoot();
  return CardService.newActionResponseBuilder()
    .setNavigation(nav)
    .build();
}