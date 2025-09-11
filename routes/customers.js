const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const QRCode = require('qrcode');
const { sendPushNotification } = require('../utils/notifications'); // Make sure you have this

router.post('/scan', async (req, res) => {
  const { customer_id, business_id } = req.body;

  try {
    const customerRes = await pool.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
    const customer = customerRes.rows[0];
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // ✅ Block if wrong business tries to scan
    if (customer.business_id !== business_id) {
      return res.status(403).json({ error: 'Unauthorized scan attempt' });
    }

    // ✅ Fetch business and plan features
    const businessRes = await pool.query(`
      SELECT b.*, p.name AS plan_name, p.allow_notifications, p.allow_advanced_rewards
      FROM businesses b
      LEFT JOIN plans p ON b.plan_id = p.id
      WHERE b.id = $1
    `, [business_id]);
    const business = businessRes.rows[0];

    let newPoints = customer.points || 0;
    let newScanCount = (customer.scan_count || 0) + 1;
    let rewardMessage = null;

    // ✅ Apply reward logic
    if (customer.reward_type === 'stamps') {
      newPoints += 1;
      if (newPoints % 5 === 0) rewardMessage = '🎉 You earned a free item!';
    } else if (customer.reward_type === 'payback') {
      newPoints += 10;
      if (newPoints >= 100 && newPoints % 100 === 0) rewardMessage = '💰 You earned $10 cashback!';
    } else if (customer.reward_type === 'onetime') {
      newPoints = 1;
      rewardMessage = '🎁 One-time reward used!';
    }

    // ✅ Save updates
    await pool.query(
      `UPDATE customers 
       SET points = $1, scan_count = $2, last_visit = NOW()
       WHERE id = $3`,
      [newPoints, newScanCount, customer_id]
    );

    // ✅ Optional: log scan to reward_history
    await pool.query(
      `INSERT INTO reward_history (customer_id, business_id, timestamp, points)
       VALUES ($1, $2, NOW(), $3)`,
      [customer_id, business_id, newPoints]
    );

    // ✅ Send notification if allowed by plan
    if (rewardMessage && business.allow_notifications && customer.fcm_token) {
      await sendPushNotification(customer.fcm_token, '🎉 Reward Unlocked!', rewardMessage);
    }

    res.json({
      message: 'Reward updated ✅',
      points: newPoints,
      reward: rewardMessage,
      returning: newScanCount > 1,
      scan_count: newScanCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Scan failed' });
  }
});

// Get all customers of the logged-in business
router.get('/', async (req, res) => {
  const { business_id } = req.query; // read from query string

  if (!business_id) {
    return res.status(400).json({ error: "business_id required" });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM customers WHERE business_id = $1',
      [business_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});


// Add new customer manually
router.post('/add', async (req, res) => {
  const { business_id, name, email, reward_type } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO customers (business_id, name, email, reward_type) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [business_id, name, email, reward_type]
    );

    const customer = result.rows[0];
    const qrData = {
      customer_id: customer.id,
      reward_type: customer.reward_type,
      business_id: customer.business_id
    };

    const qrCode = await QRCode.toDataURL(JSON.stringify(qrData));
    res.json({ customer, qrCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add customer' });
  }
});

// Join via QR (no reward type assigned yet)
router.post('/join', async (req, res) => {
  const { name, email, business_id } = req.body;

  if (!name || !email || !business_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO customers (business_id, name, email) 
       VALUES ($1, $2, $3) RETURNING *`,
      [business_id, name, email]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Join failed:', err);
    res.status(500).json({ error: 'Failed to register customer' });
  }
});

// Assign reward after scan
router.put('/:id/reward', async (req, res) => {
  const { id } = req.params;
  const { reward_type } = req.body;

  if (!reward_type) {
    return res.status(400).json({ error: 'Missing reward type' });
  }

  try {
    await pool.query(
      `UPDATE customers SET reward_type = $1 WHERE id = $2`,
      [reward_type, id]
    );
    res.json({ message: 'Reward type assigned successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign reward type' });
  }
});

// Generate QR and dummy wallet pass link
router.get('/generate-wallet-link/:business_id', async (req, res) => {
  const { business_id } = req.params;

  // Create dummy serial (replace with real wallet generation if needed)
  const serial = `wallet-${Date.now()}`;
const walletLink = `http://localhost:5000/wallet.html?serial=${serial}&business_id=${business_id}`;

  try {
    const qr = await QRCode.toDataURL(walletLink);
    res.json({ serial, walletLink, qrCode: qr });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate QR' });
  }
});

module.exports = router;
