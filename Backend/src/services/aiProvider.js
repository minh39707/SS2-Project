const { callGemini } = require('./gemini');

function getDefaultChatModel() {
  return process.env.GEMINI_CHAT_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
}

function getDefaultTaskModel() {
  return process.env.GEMINI_TASK_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
}

async function callAiModel(options = {}) {
  return callGemini(options);
}

module.exports = {
  callAiModel,
  getDefaultChatModel,
  getDefaultTaskModel,
};
