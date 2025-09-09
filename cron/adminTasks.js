const cron = require('node-cron');
const pool = require('../config/db');
const admin = require('firebase-admin');
const dayjs = require('dayjs');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
dayjs.extend(isSameOrBefore);

// Firebase init (make sure admin.initializeApp is set in your app)
if (!admin.apps.length) {
  const serviceAccount = require('../config/firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// ⏰ Runs every day at 10 AM
cron.schedule('0 10 * * *', async () => {
  console.log('Running admin cron job 🚀');

  try {
    const res = await pool.query('SELECT * FROM customers');

    for (const customer of res.rows) {
      const lastVisit = dayjs(customer.last_visit);
      const now = dayjs();

      // ✅ 1. Reward at 20 visits
      if (customer.points >= 20) {
        await sendNotification(customer.fcm_token, '🎁 Loyal Customer Reward', 'Thanks for visiting us 20+ times! Enjoy your reward.');
      }

      // 📭 2. Inactive for 1.5 months (45 days)
      if (lastVisit.isValid() && now.diff(lastVisit, 'day') >= 45) {
        await sendNotification(customer.fcm_token, '👋 We miss you!', 'It’s been a while! Drop by for something special.');
      }
    }

    console.log('✅ Admin cron completed');
  } catch (err) {
    console.error('❌ Cron failed:', err);
  }
});

// Helper
async function sendNotification(token, title, body) {
  if (!token) return;

  try {
    await admin.messaging().send({
      token,
      notification: { title, body }
    });
    console.log(`📬 Sent: ${title} => ${token}`);
  } catch (err) {
    console.error('⚠️ Notification error:', err.message);
  }
}
