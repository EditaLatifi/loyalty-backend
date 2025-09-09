// routes/googleWallet.js
const express = require("express");
const { GoogleAuth } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const serviceAccount = require("../config/wallet-service-account.json");

const router = express.Router();
const issuerId = "3388000000022946333"; // your Issuer ID

router.get("/generate-link/:customerId", async (req, res) => {
  const { customerId } = req.params;

  try {
    // Get customer
    const result = await pool.query("SELECT * FROM customers WHERE id = $1", [customerId]);
    const customer = result.rows[0];
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    // Loyalty object
    const loyaltyObject = {
      id: `${issuerId}.${customerId}`,
      classId: `${issuerId}.loyalty_class`,
      state: "active",
      accountId: customerId.toString(),
      accountName: customer.name,
      barcode: {
        type: "QR_CODE",
        value: `CUST-${customerId}-BIZ-${customer.business_id}`
      },
      loyaltyPoints: {
        balance: {
          int: customer.points || 0
        },
        label: "Points"
      }
    };

    // Build Save URL
    const payload = {
      iss: serviceAccount.client_email,
      aud: "google",
      typ: "savetowallet",
      payload: { loyaltyObjects: [loyaltyObject] }
    };

    const token = jwt.sign(payload, serviceAccount.private_key, { algorithm: "RS256" });
    const saveUrl = `https://pay.google.com/gp/v/save/${token}`;

    res.json({ saveUrl });
  } catch (err) {
    console.error("Google Wallet error:", err);
    res.status(500).json({ error: "Wallet pass generation failed" });
  }
});

module.exports = router;


