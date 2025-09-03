// 랜덤닉네임 생성 유틸리티

const ADJECTIVES = [
  '즐거운', '신나는', '행복한', '멋진', '훌륭한', '대단한', '완벽한', '최고의',
  '특별한', '유니크한', '독특한', '창의적인', '영감받은', '열정적인', '활발한',
  '친근한', '따뜻한', '정직한', '성실한', '책임감있는', '도전적인', '용감한',
  '지혜로운', '똑똑한', '재미있는', '유쾌한', '긍정적인', '낙관적인', '희망찬'
];

const NOUNS = [
  '사용자', '투표자', '참여자', '플레이어', '게이머', '팬', '러버', '매니아',
  '마스터', '챔피언', '히어로', '스타', '레전드', '킹', '퀸', '프린스', '프린세스',
  '워리어', '나이트', '메이지', '위저드', '소서러', '팔라딘', '레인저', '드루이드',
  '모험가', '탐험가', '발견자', '발명가', '창작자', '아티스트', '뮤지션', '작가',
  '시인', '철학자', '사상가', '지도자', '멘토', '코치', '트레이너', '가이드'
];

const EMOJIS = ['🥚'];

export function generateRandomNickname(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
  
  return `${adjective}${noun}${emoji}`;
}

export function generateNicknameList(count: number = 10): string[] {
  const nicknames: string[] = [];
  const usedCombinations = new Set<string>();
  
  while (nicknames.length < count) {
    const nickname = generateRandomNickname();
    const key = nickname.replace(/[^\w\s가-힣]/g, ''); // 이모지 제거한 키
    
    if (!usedCombinations.has(key)) {
      usedCombinations.add(key);
      nicknames.push(nickname);
    }
  }
  
  return nicknames;
}

