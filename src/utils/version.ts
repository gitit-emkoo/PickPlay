/**
 * 버전 문자열을 비교하는 유틸리티
 * @param a 비교할 버전 문자열 (예: "1.2.0")
 * @param b 비교할 버전 문자열 (예: "2.0.1")
 * @returns a < b면 -1, a === b면 0, a > b면 1
 */
export const compareVersion = (a: string, b: string): number => {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  
  const maxLength = Math.max(partsA.length, partsB.length);
  
  for (let i = 0; i < maxLength; i++) {
    const partA = partsA[i] || 0;
    const partB = partsB[i] || 0;
    
    if (partA < partB) return -1;
    if (partA > partB) return 1;
  }
  
  return 0;
};

/**
 * 현재 버전이 최소 필수 버전보다 낮은지 확인
 */
export const isVersionBelowMinimum = (currentVersion: string, minRequiredVersion: string): boolean => {
  return compareVersion(currentVersion, minRequiredVersion) < 0;
};

/**
 * 현재 버전이 최신 버전보다 낮은지 확인
 */
export const isVersionBelowCurrent = (currentVersion: string, latestVersion: string): boolean => {
  return compareVersion(currentVersion, latestVersion) < 0;
};

