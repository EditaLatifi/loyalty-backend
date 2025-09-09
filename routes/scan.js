const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { sendPushNotification } = require('../utils/notifications');
const { addToList } = require('../utils/mailchimp'); // Moved to top for clarity

router.post('/', async (req, res) => {
  const { customer_id } = req.body;

  try {
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = result.rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    let newPoints = customer.points || 0;
    let rewardMessage = null;
    const now = new Date();

    if (customer.reward_type === 'stamps') {
      newPoints += 1;
      if (newPoints % 4 === 0) {
        rewardMessage = "🎉 You've earned a free pizza! Leave a Google review ⭐";
      }
    } else if (customer.reward_type === 'payback') {
      newPoints += 10;
    } else if (customer.reward_type === 'onetime') {
      newPoints = 1;
      rewardMessage = '🎁 One-time reward used!';
    }

    // ✅ Update points + visit
    await pool.query(
      'UPDATE customers SET points = $1, last_visited = $2 WHERE id = $3',
      [newPoints, now, customer_id]
    );

    // ✅ INSERT into reward history table
    await pool.query(
      `INSERT INTO reward_history (customer_id, description, points_used, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [customer_id, rewardMessage || 'Scanned - no reward', newPoints]
    );

    // ✅ Mailchimp integration
    if (customer.email) addToList(customer.email);

    // ✅ Push notification if reward was triggered
    if (rewardMessage && customer.fcm_token) {
      await sendPushNotification(
        customer.fcm_token,
        '🎉 Reward Unlocked!',
        rewardMessage
      );
    }

    res.json({ message: 'Scan success ✅', points: newPoints, reward: rewardMessage });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Scan failed' });
  }
});

router.post('/scan-wallet', async (req, res) => {
  const { serial, business_id } = req.body;

  try {
    // Check if customer exists
    let result = await pool.query(
      'SELECT * FROM customers WHERE wallet_serial = $1 AND business_id = $2',
      [serial, business_id]
    );

    let customer = result.rows[0];

    // If not found, create
    if (!customer) {
      const insert = await pool.query(
        `INSERT INTO customers (business_id, name, wallet_serial, reward_type, points) 
         VALUES ($1, $2, $3, null, 0) RETURNING *`,
        [business_id, 'Wallet User', serial]
      );
      customer = insert.rows[0];
    }

    res.json({ customer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Wallet scan failed' });
  }
});

module.exports = router;
