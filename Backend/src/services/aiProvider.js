const { callLocalAi } = require('./localAi');

function getAiProvider() {
  return 'ollama';
}

function getDefaultModel(kind = 'chat') {
  return (
    (kind === 'task' ? process.env.OLLAMA_TASK_MODEL : process.env.OLLAMA_CHAT_MODEL) ||
    process.env.OLLAMA_MODEL ||
    'qwen3:8b'
  );
}

async function callAiModel(options = {}) {
  return callLocalAi(options);
}

module.exports = {
  callAiModel,
  getAiProvider,
  getDefaultModel,
};
