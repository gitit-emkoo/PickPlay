/**
 * Firestore에 푸시 스케줄러 초기 설정 생성
 * 
 * 실행 방법:
 * node scripts/init-push-scheduler.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../firebase-service-account.json');

// Firebase Admin 초기화
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function initPushScheduler() {
  try {
    console.log('📝 푸시 스케줄러 초기 설정 생성 중...');
    
    const schedulerRef = db.collection('config').doc('pushScheduler');
    
    await schedulerRef.set({
      isEnabled: true,
      scheduleTime: '20:15',
      timeZone: 'Asia/Seoul',
      schedulerAudience: 'all',
      schedulerTargetUids: '',
      title: '오늘의 질문이 기다리고 있어요! 🎯',
      body: '지금 참여하고 보상 받기!',
      lastSentDate: null,
      lastModified: new Date().toISOString()
    });
    
    console.log('✅ 푸시 스케줄러 설정 생성 완료!');
    console.log('');
    console.log('설정 내용:');
    console.log('- 활성화: true');
    console.log('- 발송 시간: 매일 20:15 (KST)');
    console.log('- 제목: 오늘의 질문이 기다리고 있어요! 🎯');
    console.log('- 내용: 지금 참여하고 보상 받기!');
    console.log('');
    console.log('💡 관리자 페이지에서 설정을 변경할 수 있습니다.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 설정 생성 실패:', error);
    process.exit(1);
  }
}

initPushScheduler();

