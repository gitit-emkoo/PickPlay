// Date utility file
export const dayIndex = () => {
  // 한국시간 기준으로 요일 반환 (0=일요일, 1=월요일, ..., 6=토요일)
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  return koreaTime.getDay();
};
