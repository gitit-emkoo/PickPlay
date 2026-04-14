// HTTP entry to be used by Cloud Functions/Run or local cron
const express = require('express');
const cors = require('cors');
const { 
  fetchExpoTokens, 
  fetchExpoTokensByUids,
  fetchSchedulerConfig,
  savePushLog,
  shouldSendNow,
  markSchedulerSent
} = require('./tokenRepository');
const { buildDailyMessage } = require('./messageBuilder');
const { sendExpoMessages } = require('./pushService');
const { requireAdminPushKey } = require('./requireAdminPushKey');
const { filterUidsByAllowlist, getAllowedUidList } = require('./pushAllowlist');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// 자동 스케줄러 전용 (Cloud Scheduler가 호출) — 관리자 키 필요
app.post('/broadcast/daily', requireAdminPushKey, async (req, res) => {
  try {
    console.log('📅 자동 스케줄러 발송 시작');
    
    // Firestore에서 스케줄러 설정 가져오기
    const config = await fetchSchedulerConfig();
    
    if (!config.isEnabled) {
      console.log('⏸️ 스케줄러가 비활성화되어 있습니다');
      return res.json({ ok: true, sent: 0, message: 'Scheduler disabled' });
    }

    // 시간/중복 체크: 스케줄 시간과 오늘 발송 여부를 기준으로 발송 제어
    const scheduleCheck = shouldSendNow(config);
    if (!scheduleCheck.ok) {
      console.log('⏸️ 자동 발송 스킵:', scheduleCheck.reason);
      return res.json({
        ok: true,
        sent: 0,
        type: 'scheduled',
        skipped: true,
        reason: scheduleCheck.reason,
      });
    }
    
    const audience = config.schedulerAudience === 'test' ? 'test' : 'all';
    let tokens;
    if (audience === 'test') {
      const fromConfig = String(config.schedulerTargetUids || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const fromEnv = getAllowedUidList();
      const targetUids = fromConfig.length > 0 ? fromConfig : fromEnv;
      if (targetUids.length === 0) {
        console.log('⏸️ 스케줄(테스트): Firestore schedulerTargetUids 및 ADMIN_PUSH_ALLOWED_UIDS 없음');
        return res.json({
          ok: true,
          sent: 0,
          type: 'scheduled',
          skipped: true,
          reason: 'scheduler-test-no-uids',
        });
      }
      tokens = await fetchExpoTokensByUids(targetUids);
    } else {
      tokens = await fetchExpoTokens();
    }
    const msg = buildDailyMessage({ 
      title: config.title, 
      body: config.body 
    });
    const messages = tokens.map(to => ({ to, ...msg }));
    await sendExpoMessages(messages);
    
    // 로그 저장
    await savePushLog({
      title: config.title,
      body: config.body,
      type: 'scheduled',
      totalTokens: tokens.length,
      successCount: tokens.length,
      failureCount: 0
    });

    if (scheduleCheck.dateKey) {
      await markSchedulerSent(scheduleCheck.dateKey);
    }
    
    console.log(`✅ 자동 발송 완료: ${messages.length}명`);
    res.json({ ok: true, sent: messages.length, type: 'scheduled' });
  } catch (e) {
    console.error('❌ 자동 발송 실패:', e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// 수동 발송 — audience: 'all' | 'test' (기본 test). test는 uids; ADMIN_PUSH_ALLOWED_UIDS가 있으면 교집합
app.post('/broadcast/custom', requireAdminPushKey, async (req, res) => {
  try {
    const { title, body, uids: rawUids, audience: rawAudience, confirmBroadcastAll } = req.body || {};
    const audience = rawAudience === 'all' ? 'all' : 'test';
    
    if (!title || !body) {
      return res.status(400).json({ 
        ok: false, 
        error: 'title and body are required' 
      });
    }

    let tokens;
    let logUids;

    if (audience === 'all') {
      if (process.env.ADMIN_PUSH_ALLOW_BROADCAST_ALL !== 'true') {
        return res.status(403).json({ ok: false, error: 'broadcast-all-disabled' });
      }
      if (confirmBroadcastAll !== true) {
        return res.status(400).json({ ok: false, error: 'confirm-broadcast-all-required' });
      }
      console.log('📤 수동 발송 시작 (전체 사용자):', { title });
      tokens = await fetchExpoTokens();
      logUids = null;
    } else {
      const requestedUids = Array.isArray(rawUids) ? rawUids : [];
      const allow = filterUidsByAllowlist(requestedUids);
      if (!allow.ok) {
        const status = allow.error === 'admin-allowlist-not-configured' ? 503 : 400;
        return res.status(status).json({ ok: false, error: allow.error });
      }
      console.log('📤 수동 발송 시작 (테스트 UID):', { title, uids: allow.uids });
      tokens = await fetchExpoTokensByUids(allow.uids);
      logUids = allow.uids;
    }

    const msg = buildDailyMessage({ title, body });
    const messages = tokens.map(to => ({ to, ...msg }));
    await sendExpoMessages(messages);
    
    await savePushLog({
      title,
      body,
      type: 'manual',
      audience,
      uids: logUids,
      totalTokens: tokens.length,
      successCount: tokens.length,
      failureCount: 0
    });
    
    console.log(`✅ 수동 발송 완료: ${messages.length}대 (${audience})`);
    res.json({ ok: true, sent: messages.length, type: 'manual', audience });
  } catch (e) {
    console.error('❌ 수동 발송 실패:', e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// 테스트/단일 발송 — uids 필수. ADMIN_PUSH_ALLOWED_UIDS 교집합만 (전체·플랫폼 전체 발송 제거)
app.post('/broadcast/test', requireAdminPushKey, async (req, res) => {
  try {
    const { title, body, uids: rawUids } = req.body || {};
    
    if (!title || !body) {
      return res.status(400).json({ 
        ok: false, 
        error: 'title and body are required' 
      });
    }
    
    const requestedUids = Array.isArray(rawUids) ? rawUids : [];
    const allow = filterUidsByAllowlist(requestedUids);
    if (!allow.ok) {
      const status = allow.error === 'admin-allowlist-not-configured' ? 503 : 400;
      return res.status(status).json({ ok: false, error: allow.error });
    }

    console.log('🧪 UID 발송 시작:', { title, uids: allow.uids });
    
    const tokens = await fetchExpoTokensByUids(allow.uids);
    
    const msg = buildDailyMessage({ title, body });
    const messages = tokens.map(to => ({ to, ...msg }));
    await sendExpoMessages(messages);
    
    // 로그 저장
    await savePushLog({
      title,
      body,
      type: 'test',
      uids: allow.uids,
      totalTokens: tokens.length,
      successCount: tokens.length,
      failureCount: 0
    });
    
    console.log(`✅ UID 발송 완료: ${messages.length}대`);
    res.json({ 
      ok: true, 
      sent: messages.length, 
      type: 'test',
      uids: allow.uids,
    });
  } catch (e) {
    console.error('❌ 테스트 발송 실패:', e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// For Cloud Functions v2 export
module.exports = app;

// If run locally: node server/index.js
if (require.main === module) {
  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`🚀 push server listening on http://localhost:${port}`);
  });
}


