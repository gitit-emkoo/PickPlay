/**
 * 관리자 전용 푸시 발송 보호.
 * 환경변수 ADMIN_PUSH_SECRET 과 요청 헤더 X-Admin-Push-Key 가 일치할 때만 통과합니다.
 * 비밀 미설정 시 broadcast 계열은 503으로 막아 오발송·무단 호출을 원천 차단합니다.
 */
function requireAdminPushKey(req, res, next) {
  const secret = process.env.ADMIN_PUSH_SECRET;
  if (!secret || String(secret).trim() === '') {
    console.warn('[push] ADMIN_PUSH_SECRET 미설정 — broadcast 경로 차단');
    return res.status(503).json({
      ok: false,
      error: 'push-admin-not-configured',
      message: 'ADMIN_PUSH_SECRET is not set on the server',
    });
  }
  const provided = req.get('x-admin-push-key') || '';
  if (provided !== secret) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }
  next();
}

module.exports = { requireAdminPushKey };
