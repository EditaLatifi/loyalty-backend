const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Get all businesses
router.get('/businesses', async (req, res) => {
  try {
const result = await pool.query('SELECT * FROM businesses ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Failed to fetch businesses:', err);
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});


router.post('/businesses', async (req, res) => {
  const { name, email, password, plan_id } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO businesses (name, email, password, plan_id, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, email, password, plan_id, 'business']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database insert failed' });
  }
});


router.get('/businesses/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM businesses WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Business not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error fetching business detail:', err);
    res.status(500).json({ error: 'Failed to fetch business detail' });
  }
});


// Delete business
router.delete('/businesses/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM businesses WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete business' });
  }
});

// Assign campaign (Mailchimp simulation)
router.post('/campaign', async (req, res) => {
  const { business_id, message } = req.body;
  try {
    // This would call Mailchimp API in real project
    console.log(`📣 Sent campaign to business ID ${business_id}: ${message}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send campaign' });
  }
});
router.post('/template/send', async (req, res) => {
  const { business_id, template_key } = req.body;

  // Example templates - in a real app, you’d store this in DB or config
  const templates = {
    happyHour: '🍻 Happy Hour! 50% off today 5–7pm',
    holiday: '🎄 Happy Holidays from us!',
    discount: '🔥 Flash Sale - 20% OFF everything',
  };

  const message = templates[template_key];

  if (!message) {
    return res.status(400).json({ error: 'Invalid template key' });
  }

  try {
    // Simulate sending template (e.g., via Mailchimp or SMS)
    console.log(`📨 Sent template to business ${business_id}: ${message}`);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Failed to send template:', err);
    res.status(500).json({ error: 'Failed to send template' });
  }
});
const QRCode = require('qrcode');

// Generate QR Code for a business
router.post('/businesses/:id/qr', async (req, res) => {
  const businessId = req.params.id;

  try {
    const qrData = { business_id: businessId };
    const qrCode = await QRCode.toDataURL(JSON.stringify(qrData));
    res.json({ qrCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'QR code generation failed' });
  }
});

module.exports = router;
