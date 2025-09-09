const express = require("express");
const QRCode = require("qrcode");
const router = express.Router();
const pool = require("../config/db");

router.get("/business-qr/:businessId", async (req, res) => {
  const { businessId } = req.params;

  try {
    const walletLink = `http://localhost:5000/wallet/start/${businessId}`;
    const qrCode = await QRCode.toDataURL(walletLink);
    res.json({ businessId, walletLink, qrCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate QR" });
  }
});

router.get("/start/:businessId", (req, res) => {
  const { businessId } = req.params;

  res.send(`
    <html>
      <body>
        <h2>Pizzaiolo Loyalty</h2>
        <form action="/wallet/register" method="POST">
          <input type="hidden" name="business_id" value="${businessId}" />
          <label>Your Name:</label>
          <input type="text" name="name" required />
          <button type="submit">Join & Get Card</button>
        </form>
      </body>
    </html>
  `);
});

router.post("/register", async (req, res) => {
  const { business_id, name } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO customers (business_id, name) VALUES ($1, $2) RETURNING *`,
      [business_id, name]
    );
    const customer = result.rows[0];

    const ua = req.headers["user-agent"];
    if (/iPhone|iPad|iPod/.test(ua)) {
      res.redirect(`/apple-wallet/generate/${customer.id}`);
    } else {
      res.redirect(`/google-wallet/generate-link/${customer.id}`);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Registration failed");
  }
});

module.exports = router;
