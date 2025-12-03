// HTTP entry to be used by Cloud Functions/Run or local cron
const express = require('express');
const cors = require('cors');
const { 
  fetchExpoTokens, 
  fetchExpoTokensByPlatform, 
  fetchExpoTokensByUids,
  fetchSchedulerConfig,
  savePushLog
} = require('./tokenRepository');
const { buildDailyMessage } = require('./messageBuilder');
const { sendExpoMessages } = require('./pushService');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// 자동 스케줄러 전용 (Cloud Scheduler가 호출)
app.post('/broadcast/daily', async (req, res) => {
  try {
    console.log('📅 자동 스케줄러 발송 시작');
    
    // Firestore에서 스케줄러 설정 가져오기
    const config = await fetchSchedulerConfig();
    
    if (!config.isEnabled) {
      console.log('⏸️ 스케줄러가 비활성화되어 있습니다');
      return res.json({ ok: true, sent: 0, message: 'Scheduler disabled' });
    }
    
    const tokens = await fetchExpoTokens();
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
    
    console.log(`✅ 자동 발송 완료: ${messages.length}명`);
    res.json({ ok: true, sent: messages.length, type: 'scheduled' });
  } catch (e) {
    console.error('❌ 자동 발송 실패:', e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// 수동 발송 (관리자 페이지에서 호출)
app.post('/broadcast/custom', async (req, res) => {
  try {
    const { title, body } = req.body || {};
    
    if (!title || !body) {
      return res.status(400).json({ 
        ok: false, 
        error: 'title and body are required' 
      });
    }
    
    console.log('📤 수동 발송 시작:', { title, body });
    
    const tokens = await fetchExpoTokens();
    const msg = buildDailyMessage({ title, body });
    const messages = tokens.map(to => ({ to, ...msg }));
    await sendExpoMessages(messages);
    
    // 로그 저장
    await savePushLog({
      title,
      body,
      type: 'manual',
      totalTokens: tokens.length,
      successCount: tokens.length,
      failureCount: 0
    });
    
    console.log(`✅ 수동 발송 완료: ${messages.length}명`);
    res.json({ ok: true, sent: messages.length, type: 'manual' });
  } catch (e) {
    console.error('❌ 수동 발송 실패:', e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// 테스트 발송 (플랫폼 필터링 또는 특정 사용자)
app.post('/broadcast/test', async (req, res) => {
  try {
    const { title, body, platform, uids } = req.body || {};
    
    if (!title || !body) {
      return res.status(400).json({ 
        ok: false, 
        error: 'title and body are required' 
      });
    }
    
    console.log('🧪 테스트 발송 시작:', { title, body, platform, uids });
    
    let tokens;
    if (uids && Array.isArray(uids) && uids.length > 0) {
      // 특정 사용자에게만 발송
      tokens = await fetchExpoTokensByUids(uids);
    } else if (platform && (platform === 'ios' || platform === 'android')) {
      // 특정 플랫폼에만 발송
      tokens = await fetchExpoTokensByPlatform(platform);
    } else {
      // 전체 발송
      tokens = await fetchExpoTokens();
    }
    
    const msg = buildDailyMessage({ title, body });
    const messages = tokens.map(to => ({ to, ...msg }));
    await sendExpoMessages(messages);
    
    // 로그 저장
    await savePushLog({
      title,
      body,
      type: 'test',
      platform: platform || 'all',
      uids: uids || [],
      totalTokens: tokens.length,
      successCount: tokens.length,
      failureCount: 0
    });
    
    console.log(`✅ 테스트 발송 완료: ${messages.length}명 (${platform || 'all'})`);
    res.json({ 
      ok: true, 
      sent: messages.length, 
      type: 'test',
      platform: platform || 'all'
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


