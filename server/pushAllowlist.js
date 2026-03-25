/**
 * ADMIN_PUSH_ALLOWED_UIDS (쉼표 구분) — 선택 사항.
 * - 비어 있음: 요청 UID 그대로 사용 (관리자 키로만 보호)
 * - 설정됨: 요청 UID와 교집합만 통과 (운영에서 테스트 계정만 허용할 때)
 */
function getAllowedUidSet() {
  const raw = process.env.ADMIN_PUSH_ALLOWED_UIDS;
  if (!raw || !String(raw).trim()) {
    return null;
  }
  return new Set(
    String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/**
 * @param {string[]} requestedUids
 * @returns {{ ok: true, uids: string[] } | { ok: false, error: string }}
 */
function filterUidsByAllowlist(requestedUids) {
  if (!Array.isArray(requestedUids) || requestedUids.length === 0) {
    return { ok: false, error: 'uids-required' };
  }
  const unique = [...new Set(requestedUids.map((u) => String(u).trim()).filter(Boolean))];
  if (unique.length === 0) {
    return { ok: false, error: 'uids-required' };
  }

  const allowed = getAllowedUidSet();
  if (!allowed || allowed.size === 0) {
    return { ok: true, uids: unique };
  }

  const filtered = unique.filter((uid) => allowed.has(uid));
  if (filtered.length === 0) {
    return { ok: false, error: 'no-uids-in-allowlist' };
  }
  return { ok: true, uids: filtered };
}

/** @returns {string[]} 허용 UID 목록 (미설정 시 빈 배열) */
function getAllowedUidList() {
  const set = getAllowedUidSet();
  if (!set || set.size === 0) {
    return [];
  }
  return [...set];
}

module.exports = { getAllowedUidSet, getAllowedUidList, filterUidsByAllowlist };
