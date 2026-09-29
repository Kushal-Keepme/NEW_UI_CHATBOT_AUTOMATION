import { LocatorDefinition } from '../types/locator.types';

export type LocatorMap = Record<string, LocatorDefinition>;

export const chatbotLocators = {

  /* Chatbot Entry Icon — the agent training page renders two buttons
     sharing id="iframe-button" ("Test Call" and "Test Agent"), so a plain
     #iframe-button selector is ambiguous under Playwright's strict mode.
     The dev UI additionally renders an unrelated tabs-list button also
     named "Test Agent" (switches config tabs, not the iframe trigger), so
     scoping by accessible role/name alone is ambiguous there too — scope
     to #iframe-button specifically to target the chat widget trigger. */
  chatbotIcon: {
    strategy: 'css',
    value: 'button#iframe-button:has-text("Test Agent")',
  },

  chatbotIframe: {
    strategy: 'css',
    value: 'iframe[title="Agent Test Iframe"]',
  },

  /* GDPR & Marketing Permissions consent — shown on open by some bots
     (e.g. production Demo Account) before the chat can be used. */
  gdprAcceptButton: {
    strategy: 'role',
    value: 'button',
    options: { name: 'Yes, I accept' },
  },

  /* Message Module */
  messageModule: {
    strategy: 'css',
    value: '#message-module',
  },

  messageList: {
    strategy: 'css',
    value: '#message-module .message-section',
  },

  /* Messages - Swapped based on observed DOM behavior:
     li.sent = Bot Responses
     li.replies = User Inputs
  */
  allMessages: {
    strategy: 'css',
    value: '#message-module li.sent, #message-module li.replies',
  },

  botMessages: {
    strategy: 'css',
    value: '#message-module li.sent #utterPara',
  },

  userMessages: {
    strategy: 'css',
    value: '#message-module li.replies #repliesPara',
  },

  latestBotMessage: {
    strategy: 'css',
    value: '#message-module li.sent:last-of-type #utterPara',
  },

  latestUserMessage: {
    strategy: 'css',
    value: '#message-module li.replies:last-of-type #repliesPara',
  },

  botMessageText: {
    strategy: 'css',
    value: '#message-module li.sent:last-of-type #utterPara',
  },

  userMessageText: {
    strategy: 'css',
    value: '#message-module li.replies:last-of-type #repliesPara',
  },

  /* Message Input */
  messageInputField: {
    strategy: 'css',
    value: 'textarea#search1',
  },

  sendButton: {
    strategy: 'xpath',
    value: '//*[@id="message-input-module"]/div/button',
  },

  /* Autosuggest */
  autoSuggestList: {
    strategy: 'css',
    value: '#autosuggest',
  },

  autoSuggestOptions: {
    strategy: 'css',
    value: '#autosuggest .list-group-item',
  },

} as const satisfies LocatorMap;
