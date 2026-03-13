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

// 주간 라이브픽용: 한국시간 기준으로 해당 날짜가 속한 주의 월요일 날짜(YYYY-MM-DD)를 계산
export const getKoreanWeekKeyFromDate = (date: Date): string => {
  // KST 기준으로 변환
  const utcMillis = date.getTime() + date.getTimezoneOffset() * 60000;
  const korea = new Date(utcMillis + 9 * 60 * 60 * 1000);
  // 요일 (일:0, 월:1, ... 토:6)
  const day = korea.getUTCDay();
  // 해당 주의 월요일까지 되돌아가기
  // 월요일(1)이면 diff=0, 일요일(0)이면 6일 전으로
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(korea.getTime() - diffToMonday * 24 * 60 * 60 * 1000);
  const year = monday.getUTCFullYear();
  const month = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(monday.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}`;
};

// 현재 한국시간 기준 weekKey 반환
export const currentWeekKeyKST = (): string => {
  const now = new Date();
  return getKoreanWeekKeyFromDate(now);
};
