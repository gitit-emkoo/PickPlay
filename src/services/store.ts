// Re-export all functions from modularized store modules
// This maintains backward compatibility with existing imports

// Data loader
export { loadData } from './store/dataLoader';

// Question related functions
export { getTodayQuestionForUser, getTodayAnswer } from './store/question';

// Answer related functions
export { saveAnswerQuick, saveAnswerAndProcessLogic } from './store/answer';

// Character related functions
export { isLegacyUser, analyzeAnswersForAdjectives, updateAdjectives_LogicB, assignCharacter_LogicA } from './store/character';

// Aggregation related functions
export { aggregate, rewardWithMajority, watchAggregation } from './store/aggregation';

// User management
export { ensureUser } from './store/userManagement';
