/**
 * Build daily reminder message
 * @param {object} options
 * @param {string} [options.title]
 * @param {string} [options.body]
 */
function buildDailyMessage(options = {}){
  const title = options.title || '오늘의 질문이 기다리고 있어요! 🎯';
  const body = options.body || '지금 참여하고 보상 받기!';
  return { title, body, data: { type: 'daily_question' } };
}

module.exports = {
  buildDailyMessage
};






