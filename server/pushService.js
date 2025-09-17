const { Expo } = require('expo-server-sdk');

const expo = new Expo();

/**
 * Send Expo push messages in chunks with receipts logging
 * @param {Array<{to:string,title:string,body:string,data:any}>} messages
 */
async function sendExpoMessages(messages){
  const valid = messages.filter(m => Expo.isExpoPushToken(m.to));
  const chunks = expo.chunkPushNotifications(valid);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const t = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...t);
    } catch (e) {
      console.error('❌ Expo push send error:', e?.message || e);
    }
  }

  // Optionally get receipts (best-effort)
  const receiptIds = tickets.map(t => t?.id).filter(Boolean);
  const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
  for (const chunk of receiptIdChunks) {
    try {
      await expo.getPushNotificationReceiptsAsync(chunk);
    } catch (e) {
      console.error('❌ Expo receipt fetch error:', e?.message || e);
    }
  }
}

module.exports = {
  sendExpoMessages
};






