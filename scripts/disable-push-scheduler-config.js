/**
 * config/pushScheduler 자동 발송 플래그만 끕니다. 푸시 API를 호출하지 않습니다.
 * node scripts/disable-push-scheduler-config.js
 */
const admin = require('firebase-admin');
const serviceAccount = require('../firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function main() {
  await db.collection('config').doc('pushScheduler').set(
    {
      isEnabled: false,
      lastModified: new Date().toISOString(),
    },
    { merge: true },
  );
  console.log('✅ config/pushScheduler.isEnabled = false 저장 완료 (발송 없음)');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
