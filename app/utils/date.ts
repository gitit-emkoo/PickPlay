// Date utility file
export const dayIndex = () => {
  // 한국시간(KST, UTC+9) 기준 요일 반환 (일요일: 0, 월요일: 1, ..., 토요일: 6)
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  return koreaTime.getUTCDay(); // UTC 기준 요일을 사용해야 KST로 변환된 시간의 정확한 요일이 나옵니다.
};

// 한국시간 기준 날짜 키 반환 (YYYYMMDD 형식)
export const currentDateKey = () => {
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  const year = koreaTime.getUTCFullYear();
  const month = String(koreaTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(koreaTime.getUTCDate()).padStart(2, '0');
  return parseInt(`${year}${month}${day}`);
};
