// Date utility file
export const dayIndex = () => {
  // 한국시간 기준으로 날짜 반환 (YYYYMMDD 형식)
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  const year = koreaTime.getFullYear();
  const month = String(koreaTime.getMonth() + 1).padStart(2, '0');
  const day = String(koreaTime.getDate()).padStart(2, '0');
  return parseInt(`${year}${month}${day}`);
};
