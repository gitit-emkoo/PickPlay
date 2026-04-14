/**
 * Firestore에서 사용자 데이터 확인 스크립트
 * 
 * 사용법:
 * node check-firestore-users.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./pickplay/firebase-service-account.json');

// Firebase Admin 초기화
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkUsers() {
  try {
    console.log('=== Firestore 사용자 데이터 확인 ===\n');

    const deviceUID = 'device_830e0412e4136322';
    const oldUID = 'dn3yOwshurM3yGRGUB8oTJkhjIC3';
    const newUID = 'mlCjICRQsIb85dSBYhcc96X3vR83';

    // 1. deviceUID로 검색
    console.log(`1. deviceUID "${deviceUID}"로 검색:`);
    const deviceUIDQuery = await db.collection('users')
      .where('deviceUID', '==', deviceUID)
      .get();
    
    console.log(`   발견된 문서 수: ${deviceUIDQuery.size}개\n`);
    
    deviceUIDQuery.forEach((doc, index) => {
      const data = doc.data();
      console.log(`   문서 ${index + 1}:`);
      console.log(`   - 문서 ID (UID): ${doc.id}`);
      console.log(`   - deviceUID: ${data.deviceUID || '(없음)'}`);
      console.log(`   - nickname: ${data.nickname || '(없음)'}`);
      console.log(`   - points: ${data.points || 0}`);
      console.log(`   - streakCount: ${data.streakCount || 0}`);
      console.log(`   - totalSelections: ${data.totalSelections || 0}`);
      console.log(`   - createdAt: ${data.createdAt ? data.createdAt.toDate() : '(없음)'}`);
      console.log('');
    });

    // 2. 기존 사용자(dn3yOwshurM3yGRGUB8oTJkhjIC3) 확인
    console.log(`2. 기존 사용자 "${oldUID}" 확인:`);
    const oldUserDoc = await db.collection('users').doc(oldUID).get();
    
    if (oldUserDoc.exists) {
      const oldData = oldUserDoc.data();
      console.log('   문서 존재함');
      console.log(`   - deviceUID: ${oldData.deviceUID || '(없음)'}`);
      console.log(`   - nickname: ${oldData.nickname || '(없음)'}`);
      console.log(`   - points: ${oldData.points || 0}`);
      console.log(`   - streakCount: ${oldData.streakCount || 0}`);
      console.log(`   - totalSelections: ${oldData.totalSelections || 0}`);
      console.log(`   - createdAt: ${oldData.createdAt ? oldData.createdAt.toDate() : '(없음)'}`);
    } else {
      console.log('   ❌ 문서가 존재하지 않음');
    }
    console.log('');

    // 3. 새 사용자(mlCjICRQsIb85dSBYhcc96X3vR83) 확인
    console.log(`3. 새 사용자 "${newUID}" 확인:`);
    const newUserDoc = await db.collection('users').doc(newUID).get();
    
    if (newUserDoc.exists) {
      const newData = newUserDoc.data();
      console.log('   문서 존재함');
      console.log(`   - deviceUID: ${newData.deviceUID || '(없음)'}`);
      console.log(`   - nickname: ${newData.nickname || '(없음)'}`);
      console.log(`   - points: ${newData.points || 0}`);
      console.log(`   - streakCount: ${newData.streakCount || 0}`);
      console.log(`   - totalSelections: ${newData.totalSelections || 0}`);
      console.log(`   - createdAt: ${newData.createdAt ? newData.createdAt.toDate() : '(없음)'}`);
    } else {
      console.log('   ❌ 문서가 존재하지 않음');
    }

    console.log('\n=== 확인 완료 ===');
    process.exit(0);
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    process.exit(1);
  }
}

checkUsers();
