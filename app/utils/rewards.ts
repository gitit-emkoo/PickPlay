/**
 * 연속 참여일수에 따른 보상 배수를 계산합니다.
 * @param streak 연속 참여일수
 * @returns 보상 배수 (1, 2, 또는 3)
 */
export function getStreakMultiplier(streak?: number): number {
  if (!streak) return 1;
  return streak >= 31 ? 3 : streak >= 11 ? 2 : 1;
}

/**
 * 다수/소수 선택에 따른 기본 포인트를 계산합니다.
 * @param isMajority 다수 선택 여부
 * @returns 기본 포인트 (다수: 5P, 소수: 10P)
 */
export function getBasePoints(isMajority: boolean): number {
  return isMajority ? 5 : 10;
}

/**
 * 최종 포인트를 계산합니다.
 * @param isMajority 다수 선택 여부
 * @param streakCount 연속 참여일수
 * @returns 최종 포인트 (기본 × 배수)
 */
export function calculateTotalPoints(isMajority: boolean, streakCount: number): number {
  const basePoints = getBasePoints(isMajority);
  const multiplier = getStreakMultiplier(streakCount);
  return basePoints * multiplier;
}

/**
 * 집계 결과에서 다수 선택인지 판별합니다.
 * @param myChoice 내 선택 (0 또는 1)
 * @param count0 선택지 0의 투표 수
 * @param count1 선택지 1의 투표 수
 * @returns 다수 선택 여부
 */
export function isMajorityChoice(myChoice: number, count0: number, count1: number): boolean {
  if (count0 === count1) return true; // 동점은 다수로 처리
  const majorityIndex = count0 >= count1 ? 0 : 1;
  return myChoice === majorityIndex;
}






