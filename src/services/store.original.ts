// Re-export all functions from modularized store modules
// This maintains backward compatibility with existing imports

// Data loader
export { loadData } from './store/dataLoader';

// Question related functions
export { getTodayQuestionForUser, getTodayAnswer } from './store/question';

// Aggregation related functions
export { aggregate, rewardWithMajority, watchAggregation } from './store/aggregation';

// Note: ensureUser, saveAnswerQuick, saveAnswerAndProcessLogic, and character logic
// functions are still in this file temporarily and will be modularized next.
// This allows for incremental refactoring without breaking existing code.

// Re-export from the original file (temporarily - will be moved to modules)
export { ensureUser, saveAnswerQuick, saveAnswerAndProcessLogic } from './store.original';
export { aggregate, rewardWithMajority, watchAggregation } from './store/aggregation';
export { getTodayQuestionForUser, getTodayAnswer } from './store/question';
export { loadData } from './store/dataLoader';
