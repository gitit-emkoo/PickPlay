const admin = require('firebase-admin');

// Firebase Admin 초기화 (한 번만)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();

/**
 * Firestore에서 모든 Expo 푸시 토큰 가져오기
 * @returns {Promise<string[]>} 토큰 배열
 */
async function fetchExpoTokens() {
  try {
    const snapshot = await db.collection('user_push_tokens').get();
    const tokens = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const token = data?.expo?.token;
      if (token && typeof token === 'string') {
        tokens.push(token);
      }
    });
    
    console.log(`✅ 총 ${tokens.length}개의 푸시 토큰 조회 완료`);
    return tokens;
  } catch (error) {
    console.error('❌ 토큰 조회 실패:', error);
    throw error;
  }
}

/**
 * 플랫폼별로 토큰 가져오기
 * @param {'ios'|'android'|'all'} platform 
 * @returns {Promise<string[]>} 토큰 배열
 */
async function fetchExpoTokensByPlatform(platform = 'all') {
  try {
    const snapshot = await db.collection('user_push_tokens').get();
    const tokens = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const token = data?.expo?.token;
      const userPlatform = data?.expo?.platform;
      
      if (token && typeof token === 'string') {
        if (platform === 'all' || userPlatform === platform) {
          tokens.push(token);
        }
      }
    });
    
    console.log(`✅ ${platform} 플랫폼: ${tokens.length}개의 푸시 토큰 조회 완료`);
    return tokens;
  } catch (error) {
    console.error('❌ 플랫폼별 토큰 조회 실패:', error);
    throw error;
  }
}

/**
 * 특정 사용자들의 토큰만 가져오기 (테스트용)
 * @param {string[]} uids 사용자 UID 배열
 * @returns {Promise<string[]>} 토큰 배열
 */
async function fetchExpoTokensByUids(uids) {
  try {
    if (!uids || uids.length === 0) {
      return [];
    }
    
    const tokens = [];
    
    // Firestore는 한 번에 10개까지만 'in' 쿼리 가능
    const chunks = [];
    for (let i = 0; i < uids.length; i += 10) {
      chunks.push(uids.slice(i, i + 10));
    }
    
    for (const chunk of chunks) {
      const snapshot = await db.collection('user_push_tokens')
        .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
        .get();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const token = data?.expo?.token;
        if (token && typeof token === 'string') {
          tokens.push(token);
        }
      });
    }
    
    console.log(`✅ ${uids.length}명의 사용자 중 ${tokens.length}개의 토큰 조회 완료`);
    return tokens;
  } catch (error) {
    console.error('❌ UID별 토큰 조회 실패:', error);
    throw error;
  }
}

/**
 * 스케줄러 설정 가져오기
 * @returns {Promise<object>} 스케줄러 설정
 */
async function fetchSchedulerConfig() {
  try {
    const doc = await db.collection('config').doc('pushScheduler').get();
    if (!doc.exists) {
      return {
        isEnabled: true,
        scheduleTime: '20:15',
        timeZone: 'Asia/Seoul',
        title: '오늘의 질문이 기다리고 있어요! 🎯',
        body: '지금 참여하고 보상 받기!',
        lastSentDate: null,
        schedulerAudience: 'all',
        schedulerTargetUids: '',
      };
    }
    const data = doc.data() || {};
    return {
      isEnabled: data.isEnabled !== false,
      scheduleTime: data.scheduleTime || '20:15',
      timeZone: data.timeZone || 'Asia/Seoul',
      title: data.title || '오늘의 질문이 기다리고 있어요! 🎯',
      body: data.body || '지금 참여하고 보상 받기!',
      lastSentDate: data.lastSentDate || null,
      schedulerAudience: data.schedulerAudience === 'test' ? 'test' : 'all',
      schedulerTargetUids:
        typeof data.schedulerTargetUids === 'string' ? data.schedulerTargetUids : '',
    };
  } catch (error) {
    console.error('❌ 스케줄러 설정 조회 실패:', error);
    return {
      isEnabled: true,
      scheduleTime: '20:15',
      timeZone: 'Asia/Seoul',
      title: '오늘의 질문이 기다리고 있어요! 🎯',
      body: '지금 참여하고 보상 받기!',
      lastSentDate: null,
      schedulerAudience: 'all',
      schedulerTargetUids: '',
    };
  }
}

function getKstDateParts(now = new Date()) {
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const year = kst.getFullYear();
  const month = String(kst.getMonth() + 1).padStart(2, '0');
  const day = String(kst.getDate()).padStart(2, '0');
  const hour = String(kst.getHours()).padStart(2, '0');
  const minute = String(kst.getMinutes()).padStart(2, '0');
  return {
    dateKey: `${year}${month}${day}`,
    hhmm: `${hour}:${minute}`,
  };
}

function shouldSendNow(config, now = new Date()) {
  if (!config?.isEnabled) {
    return { ok: false, reason: 'disabled' };
  }

  const scheduleTime = (config.scheduleTime || '').trim();
  const valid = /^([01]\d|2[0-3]):([0-5]\d)$/.test(scheduleTime);
  if (!valid) {
    return { ok: false, reason: 'invalid-schedule-time' };
  }

  const { dateKey, hhmm } = getKstDateParts(now);
  if (config.lastSentDate === dateKey) {
    return { ok: false, reason: 'already-sent-today' };
  }
  if (scheduleTime !== hhmm) {
    return { ok: false, reason: `not-time-yet(${hhmm})` };
  }
  return { ok: true, reason: 'ok', dateKey };
}

async function markSchedulerSent(dateKey) {
  try {
    await db.collection('config').doc('pushScheduler').set(
      {
        lastSentDate: dateKey,
        lastSentAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error('❌ 스케줄러 lastSent 갱신 실패:', error);
  }
}

/**
 * 푸시 로그 저장
 * @param {object} logData 로그 데이터
 */
async function savePushLog(logData) {
  try {
    await db.collection('push_logs').add({
      ...logData,
      sentAt: new Date().toISOString()
    });
    console.log('✅ 푸시 로그 저장 완료');
  } catch (error) {
    console.error('❌ 푸시 로그 저장 실패:', error);
  }
}

module.exports = {
  fetchExpoTokens,
  fetchExpoTokensByPlatform,
  fetchExpoTokensByUids,
  fetchSchedulerConfig,
  savePushLog,
  shouldSendNow,
  markSchedulerSent,
};






