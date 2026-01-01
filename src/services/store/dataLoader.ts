import { Character, Question } from '../../types';

// 전역 변수 (다른 모듈에서도 사용)
let questions: Question[] = [];
let characters: Character[] = [];

export const loadData = () => {
  try {
    // require를 사용하여 JSON 파일을 동기적으로 로드합니다.
    questions = require('../../../assets/data/questions_final.json');
    characters = require('../../../assets/data/characters_19.json');
    console.log(`✅ [Data] ${questions.length}개의 질문과 ${characters.length}개의 캐릭터 데이터를 로드했습니다.`);
  } catch (error) {
    console.error("❌ [Data] 데이터 파일 로딩에 실패했습니다:", error);
  }
};

// 다른 모듈에서 사용할 수 있도록 export
export const getQuestions = (): Question[] => questions;
export const getCharacters = (): Character[] => characters;

