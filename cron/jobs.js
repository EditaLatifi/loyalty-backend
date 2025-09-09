const cron = require('node-cron');
const pool = require('../config/db');
const { sendPushNotification } = require('../utils/notifications');

// CRON 1: Customers who visited 20 times
cron.schedule('0 2 * * *', async () => {
  const res = await pool.query(
    "SELECT * FROM customers WHERE points >= 20 AND fcm_token IS NOT NULL"
  );
  for (const user of res.rows) {
    await sendPushNotification(user.fcm_token, '🏆 Loyalty Reward', 'You’ve visited 20 times! Ask for your VIP gift 🎁');
  }
});

// CRON 2: Customers inactive for 1.5 months
cron.schedule('0 3 * * *', async () => {
  const res = await pool.query(`
    SELECT * FROM customers 
    WHERE last_visited < NOW() - INTERVAL '45 days' 
    AND fcm_token IS NOT NULL
  `);
  for (const user of res.rows) {
    await sendPushNotification(user.fcm_token, 'We Miss You 💔', 'Haven’t seen you in a while. Come back for a treat!');
  }
});
