const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO businesses (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashed]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: 'Email already exists or invalid input' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(`
      SELECT b.*, 
             p.name AS plan_name,
             p.allow_notifications,
             p.allow_mailchimp,
             p.allow_advanced_rewards
      FROM businesses b
      LEFT JOIN plans p ON b.plan_id = p.id
      WHERE b.email = $1
    `, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    res.json({
      token,
      business: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan_name: user.plan_name,
        features: {
          notifications: user.allow_notifications,
          mailchimp: user.allow_mailchimp,
          advanced_rewards: user.allow_advanced_rewards
        }
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});





module.exports = router;
