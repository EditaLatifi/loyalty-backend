const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const pool = require('../config/db');
const { sendPushNotification } = require('../utils/notifications');

// Initialize Firebase only once (do this in a central place ideally)
const serviceAccount = require('../config/firebase-service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

router.post('/send', async (req, res) => {
  const { customer_id } = req.body;

  try {
    const result = await pool.query(
      'SELECT fcm_token FROM customers WHERE id = $1',
      [customer_id]
    );

    const customer = result.rows[0];
    if (!customer || !customer.fcm_token) {
      return res.status(404).json({ error: 'No FCM token found for customer' });
    }

    const message = {
      notification: {
        title: '🎁 Loyalty Reward!',
        body: 'You just earned points!'
      },
      token: customer.fcm_token
    };

    const response = await admin.messaging().send(message);
    res.json({ success: true, response });
  } catch (err) {
    console.error('Notification error:', err);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});
// 📢 Broadcast to all customers with tokens
router.post('/broadcast', async (req, res) => {
  const { message } = req.body;
  try {
    const result = await pool.query('SELECT fcm_token FROM customers WHERE fcm_token IS NOT NULL');
    const tokens = result.rows.map(row => row.fcm_token);

    const messages = tokens.map(token => ({
      token,
      notification: {
        title: '📣 Announcement!',
        body: message,
      },
    }));

    const batchResponses = await Promise.all(
      messages.map(msg => admin.messaging().send(msg).catch(err => ({ error: err.message })))
    );

    const successCount = batchResponses.filter(r => !r.error).length;

    res.json({ success: true, sent: successCount, failed: tokens.length - successCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Broadcast failed' });
  }
});
// Admin sends broadcast to one business's customers
router.post('/admin-template', async (req, res) => {
  const { business_id, template_id } = req.body;

  const templates = {
    1: { title: '🍕 Happy Hour!', body: 'Buy 1 Get 1 Free Pizza – Today Only!' },
    2: { title: '🎉 Holiday Deal', body: '50% off everything this weekend!' },
    3: { title: '⏰ New Hours', body: 'We are now open till 11 PM!' },
    4: { title: '🔥 Limited Offer', body: 'Free drink with every meal – today only!' }
  };

  const template = templates[template_id];
  if (!template) return res.status(400).json({ error: 'Invalid template ID' });

  try {
    const result = await pool.query(
      'SELECT fcm_token FROM customers WHERE business_id = $1 AND fcm_token IS NOT NULL',
      [business_id]
    );

    const tokens = result.rows.map(r => r.fcm_token);
    const sendTasks = tokens.map(token => sendPushNotification(token, template.title, template.body));

    await Promise.all(sendTasks);

    res.json({ success: true, sent: tokens.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Broadcast failed' });
  }
});
module.exports = router;
