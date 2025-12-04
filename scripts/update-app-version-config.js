const admin = require('firebase-admin');
const path = require('path');

// Firebase Admin SDK 초기화
const serviceAccount = require('../firebase-service-account.json');

console.log('🔑 서비스 계정 정보:', {
  projectId: serviceAccount.project_id,
  clientEmail: serviceAccount.client_email,
});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'today-balance-fa0a5'
});

// Firestore 초기화
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

console.log('🏗️ Firebase 앱 초기화 완료');

// appVersion 설정 업데이트 함수
async function updateAppVersionConfig() {
  try {
    // 명령줄 인자로 버전을 받을 수 있음
    const args = process.argv.slice(2);
    const currentVersion = args[0] || '1.3.0';
    const minRequiredVersion = args[1] || '1.0.0';
    const forceUpdate = args[2] === 'true' || args[2] === '1';
    
    const config = {
      currentVersion: currentVersion,  // 현재 버전보다 높게 설정
      minRequiredVersion: minRequiredVersion,  // 최소 필수 버전
      forceUpdate: forceUpdate,  // false = 선택 업데이트, true = 강제 업데이트
      updateMessage: forceUpdate 
        ? '중요한 업데이트가 있습니다. 업데이트가 필요합니다!' 
        : '새로운 기능이 추가되었습니다! 업데이트해주세요.',
    };

    console.log('🚀 appVersion 설정 업데이트 시작...');
    console.log('📝 설정 내용:', config);

    const configRef = db.collection('config').doc('appVersion');
    
    // 문서가 없으면 생성, 있으면 업데이트
    await configRef.set(config, { merge: true });

    console.log('✅ appVersion 설정 업데이트 완료!');
    console.log('📋 업데이트된 설정:');
    console.log(JSON.stringify(config, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 업데이트 실패:', error);
    process.exit(1);
  }
}

// 스크립트 실행
updateAppVersionConfig();

