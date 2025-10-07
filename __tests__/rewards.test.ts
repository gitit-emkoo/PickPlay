import {
  getStreakMultiplier,
  getBasePoints,
  calculateTotalPoints,
  isMajorityChoice,
} from '../app/utils/rewards';

describe('Rewards Logic Tests', () => {
  
  describe('getStreakMultiplier', () => {
    it('1~10일 연속: 1배 배수', () => {
      expect(getStreakMultiplier(1)).toBe(1);
      expect(getStreakMultiplier(5)).toBe(1);
      expect(getStreakMultiplier(10)).toBe(1);
    });

    it('11~30일 연속: 2배 배수', () => {
      expect(getStreakMultiplier(11)).toBe(2);
      expect(getStreakMultiplier(15)).toBe(2);
      expect(getStreakMultiplier(30)).toBe(2);
    });

    it('31일 이상 연속: 3배 배수', () => {
      expect(getStreakMultiplier(31)).toBe(3);
      expect(getStreakMultiplier(50)).toBe(3);
      expect(getStreakMultiplier(100)).toBe(3);
    });

    it('0 또는 undefined: 1배 배수', () => {
      expect(getStreakMultiplier(0)).toBe(1);
      expect(getStreakMultiplier(undefined)).toBe(1);
    });

    it('경계값 테스트', () => {
      expect(getStreakMultiplier(10)).toBe(1); // 10일 → 1배
      expect(getStreakMultiplier(11)).toBe(2); // 11일 → 2배
      expect(getStreakMultiplier(30)).toBe(2); // 30일 → 2배
      expect(getStreakMultiplier(31)).toBe(3); // 31일 → 3배
    });
  });

  describe('getBasePoints', () => {
    it('다수 선택: 5P', () => {
      expect(getBasePoints(true)).toBe(5);
    });

    it('소수 선택: 10P', () => {
      expect(getBasePoints(false)).toBe(10);
    });
  });

  describe('calculateTotalPoints', () => {
    it('다수 선택, 1일 연속: 5P', () => {
      expect(calculateTotalPoints(true, 1)).toBe(5);
    });

    it('소수 선택, 1일 연속: 10P', () => {
      expect(calculateTotalPoints(false, 1)).toBe(10);
    });

    it('다수 선택, 11일 연속: 10P (5P × 2배)', () => {
      expect(calculateTotalPoints(true, 11)).toBe(10);
    });

    it('소수 선택, 11일 연속: 20P (10P × 2배)', () => {
      expect(calculateTotalPoints(false, 11)).toBe(20);
    });

    it('다수 선택, 31일 연속: 15P (5P × 3배)', () => {
      expect(calculateTotalPoints(true, 31)).toBe(15);
    });

    it('소수 선택, 31일 연속: 30P (10P × 3배)', () => {
      expect(calculateTotalPoints(false, 31)).toBe(30);
    });
  });

  describe('isMajorityChoice', () => {
    it('다수 선택한 경우: true', () => {
      expect(isMajorityChoice(0, 60, 40)).toBe(true); // 0이 다수
      expect(isMajorityChoice(1, 30, 70)).toBe(true); // 1이 다수
    });

    it('소수 선택한 경우: false', () => {
      expect(isMajorityChoice(0, 40, 60)).toBe(false); // 0이 소수
      expect(isMajorityChoice(1, 70, 30)).toBe(false); // 1이 소수
    });

    it('동점인 경우: true (다수로 처리)', () => {
      expect(isMajorityChoice(0, 50, 50)).toBe(true);
      expect(isMajorityChoice(1, 50, 50)).toBe(true);
    });

    it('한쪽이 0인 경우', () => {
      expect(isMajorityChoice(0, 100, 0)).toBe(true); // 0이 다수
      expect(isMajorityChoice(1, 0, 100)).toBe(true); // 1이 다수
      expect(isMajorityChoice(0, 0, 100)).toBe(false); // 0이 소수
    });
  });
});

