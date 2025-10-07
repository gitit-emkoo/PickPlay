import { currentDateKey, dayIndex } from '../app/utils/date';

describe('Date Utility Tests', () => {
  
  describe('currentDateKey', () => {
    it('YYYYMMDD 형식의 숫자를 반환해야 함', () => {
      const key = currentDateKey();
      
      // 8자리 숫자인지 확인
      expect(key.toString().length).toBe(8);
      expect(typeof key).toBe('number');
      
      // 값이 합리적인 범위인지 확인 (2020년 이후)
      expect(key).toBeGreaterThanOrEqual(20200101);
      expect(key).toBeLessThan(21000101); // 2100년 이전
    });

    it('올바른 형식인지 확인', () => {
      const key = currentDateKey();
      const keyStr = key.toString();
      
      // YYYY 부분 (첫 4자리)
      const year = parseInt(keyStr.substring(0, 4));
      expect(year).toBeGreaterThanOrEqual(2020);
      expect(year).toBeLessThan(2100);
      
      // MM 부분 (5-6번째 자리)
      const month = parseInt(keyStr.substring(4, 6));
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
      
      // DD 부분 (7-8번째 자리)
      const day = parseInt(keyStr.substring(6, 8));
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(31);
    });

    it('한국 시간 기준으로 동작해야 함', () => {
      // 이 테스트는 실제 KST 시간대에서 실행될 때만 정확합니다
      const key = currentDateKey();
      const now = new Date();
      const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
      
      const expectedYear = kstTime.getUTCFullYear();
      const expectedMonth = String(kstTime.getUTCMonth() + 1).padStart(2, '0');
      const expectedDay = String(kstTime.getUTCDate()).padStart(2, '0');
      const expected = parseInt(`${expectedYear}${expectedMonth}${expectedDay}`);
      
      expect(key).toBe(expected);
    });
  });

  describe('dayIndex', () => {
    it('0~6 사이의 숫자를 반환해야 함 (일요일=0, 토요일=6)', () => {
      const day = dayIndex();
      
      expect(day).toBeGreaterThanOrEqual(0);
      expect(day).toBeLessThanOrEqual(6);
      expect(typeof day).toBe('number');
      expect(Number.isInteger(day)).toBe(true);
    });

    it('한국 시간 기준 요일을 반환해야 함', () => {
      const day = dayIndex();
      const now = new Date();
      const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
      const expected = kstTime.getUTCDay();
      
      expect(day).toBe(expected);
    });
  });
});

