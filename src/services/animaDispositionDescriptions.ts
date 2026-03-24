/**
 * 애니마코드 성향 조합 설명 (assets/data/Description_changedisposition.json)
 * 키: 형용사1_형용사2 — 값: { tag1, tag2, description }
 */

export const DISPOSITION_DESCRIPTION_FALLBACK =
  '성향 조합 설명을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';

type DispositionEntry = {
  tag1: string;
  tag2: string;
  description: string;
};

let validatedOnce = false;

function validateKeyTagConsistency(map: Record<string, DispositionEntry>) {
  if (validatedOnce) return;
  validatedOnce = true;
  for (const [key, entry] of Object.entries(map)) {
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.tag1 !== 'string' || typeof entry.tag2 !== 'string') continue;
    const expected = `${entry.tag1}_${entry.tag2}`;
    if (key !== expected) {
      console.warn(
        `[DispositionJSON] 키와 tag1_tag2 불일치: key="${key}" expected="${expected}"`
      );
    }
  }
}

function loadDispositionMap(): Record<string, DispositionEntry> {
  const data = require('../../assets/data/Description_changedisposition.json') as Record<
    string,
    DispositionEntry
  >;
  validateKeyTagConsistency(data);
  return data;
}

/**
 * 현재 형용사1+형용사2 조합에 해당하는 설명 문구.
 * 키 없음/빈 문자열 시 fallback + 경고 로그.
 */
export function getDispositionDescription(
  tag1: string | null | undefined,
  tag2: string | null | undefined
): string {
  if (!tag1?.trim() || !tag2?.trim()) {
    console.warn('[DispositionJSON] tag1 또는 tag2 없음 → fallback');
    return DISPOSITION_DESCRIPTION_FALLBACK;
  }
  const key = `${tag1}_${tag2}`;
  const map = loadDispositionMap();
  const entry = map[key];
  const desc = entry?.description?.trim();
  if (!desc) {
    console.warn(`[DispositionJSON] 설명 없음 또는 빈 값: key="${key}"`);
    return DISPOSITION_DESCRIPTION_FALLBACK;
  }
  return desc;
}
