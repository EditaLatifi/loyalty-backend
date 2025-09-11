// routes/wallet.js
const express = require("express");
const QRCode = require("qrcode");
const router = express.Router();
const pool = require("../config/db");

/**
 * ENV:
 *  PUBLIC_ORIGIN=https://by-bc.com          // ku shërben backend-i
 *  FORM_REQUIRE_EMAIL=true/false            // nese do te detyrosh email
 */
//const ORIGIN = process.env.PUBLIC_ORIGIN || "http://localhost:5000";
const ORIGIN = "https://loyalty-backend-mu.vercel.app";

/* ----------------------------- Helpers ------------------------------ */
function isAppleUA(ua = "") {
  return /iPhone|iPad|iPod/i.test(ua);
}
function sanitizeText(v, max = 120) {
  return String(v ?? "").trim().slice(0, max);
}
function sanitizeEmail(v) {
  v = String(v ?? "").trim();
  return v.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) ? v : "";
}
function sanitizePhone(v) {
  v = String(v ?? "").replace(/[^\d+]/g, "");
  return v.length >= 6 ? v : "";
}

/* --------------------------- QR endpoint ---------------------------- */
/**
 * PNG i pastër për print/dash – vendose në flyer ose në dashboard si <img src="...png">
 * Shënim: mos e kthe base64 në JSON – browserat e kuptojnë PNG direkt.
 */
router.get("/business-qr/:businessId.png", async (req, res) => {
  const businessId = parseInt(req.params.businessId, 10);
  if (!Number.isFinite(businessId) || businessId <= 0) {
    return res.status(400).send("invalid businessId");
  }
  try {
const walletLink = `${ORIGIN}/api/wallet/start/${businessId}`;
    res.type("image/png");
    await QRCode.toFileStream(res, walletLink, { margin: 1, scale: 6 });
  } catch (err) {
    console.error("[QR] error:", err);
    res.status(500).send("Failed to generate QR");
  }
});

/* --------------------------- Start (Form) --------------------------- */
/**
 * Form minimal për t’u bashkuar. Mund ta zëvendësosh me UI tënd React,
 * por ky endpoint të lejon test të shpejtë nga telefoni.
 */
router.get("/start/:businessId", async (req, res) => {
  const businessId = parseInt(req.params.businessId, 10);
  if (!Number.isFinite(businessId) || businessId <= 0) {
    return res.status(400).send("invalid businessId");
  }

  // opsionale: verifiko që biznesi ekziston
  try {
    const biz = await pool.query(
      "SELECT id,name FROM businesses WHERE id=$1 LIMIT 1",
      [businessId]
    );
    if (!biz.rows[0]) return res.status(404).send("Business not found");
  } catch (e) {
    console.error("[start] biz check:", e);
  }

  const requireEmail = (process.env.FORM_REQUIRE_EMAIL || "false") === "true";

  res.type("html").send(`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>Join Loyalty</title>
    <style>
      body{font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; padding:20px;}
      form{max-width:480px; margin:auto; display:grid; gap:12px;}
      input,button{padding:12px; font-size:16px;}
      button{cursor:pointer}
      .hint{color:#666; font-size:14px}
    </style>
  </head>
  <body>
    <h2>Join Loyalty</h2>
   <form action="/api/wallet/register" method="POST">
  <input type="hidden" name="business_id" value="${businessId}"/>
  <label>Name</label>
  <input type="text" name="name" required placeholder="Your name"/>
  <label>Email ${requireEmail ? "(required)" : "(optional)"} </label>
  <input type="email" name="email" ${requireEmail ? "required" : ""} placeholder="you@example.com"/>
  <label>Phone (optional)</label>
  <input type="tel" name="phone" placeholder="+383..."/>
  <button type="submit">Join & Get Card</button>
  <div class="hint">We’ll add the card to Apple/Google Wallet automatically.</div>
</form>

  </body>
</html>
  `);
});

/* ----------------------------- Register ---------------------------- */
/**
 * - upsert customer sipas (business_id, email) ose (phone) nëse ekzistojnë
 * - krijo wallet nëse mungon
 * - ridrejto te Apple ose Google wallet generators
 */
router.post("/register", express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const businessId = parseInt(req.body.business_id, 10);
    const name = sanitizeText(req.body.name, 120);
    const email = sanitizeEmail(req.body.email);
    const phone = sanitizePhone(req.body.phone);

    if (!Number.isFinite(businessId) || businessId <= 0) {
      return res.status(400).send("invalid business_id");
    }
    if (!name) {
      return res.status(400).send("name is required");
    }

    // 1) gjej ose krijo customer (prefero email; përndryshe phone; fallback name)
    let customer;
    if (email) {
      const q = await pool.query(
        `SELECT * FROM customers WHERE business_id=$1 AND email=$2 LIMIT 1`,
        [businessId, email]
      );
      customer = q.rows[0];
      if (!customer) {
        const ins = await pool.query(
          `INSERT INTO customers (business_id, name, email, phone)
           VALUES ($1,$2,$3,$4) RETURNING *`,
          [businessId, name, email, phone || null]
        );
        customer = ins.rows[0];
      } else {
        // refresh emrin/telefonin nëse bosh
        await pool.query(
          `UPDATE customers SET name=COALESCE(NULLIF($1,''), name), phone=COALESCE(NULLIF($2,''), phone)
           WHERE id=$3`,
          [name, phone, customer.id]
        );
      }
    } else if (phone) {
      const q = await pool.query(
        `SELECT * FROM customers WHERE business_id=$1 AND phone=$2 LIMIT 1`,
        [businessId, phone]
      );
      customer = q.rows[0];
      if (!customer) {
        const ins = await pool.query(
          `INSERT INTO customers (business_id, name, phone)
           VALUES ($1,$2,$3) RETURNING *`,
          [businessId, name, phone]
        );
        customer = ins.rows[0];
      }
    } else {
      // fallback – jo ideal për prod, por lejon testim
      const ins = await pool.query(
        `INSERT INTO customers (business_id, name)
         VALUES ($1,$2) RETURNING *`,
        [businessId, name]
      );
      customer = ins.rows[0];
    }

    // 2) siguro wallet
    const w = await pool.query(
      `SELECT * FROM wallets WHERE business_id=$1 AND customer_id=$2 LIMIT 1`,
      [businessId, customer.id]
    );
    if (!w.rows[0]) {
      await pool.query(
        `INSERT INTO wallets (business_id, customer_id, points, last_scanned)
         VALUES ($1,$2,0,NOW())`,
        [businessId, customer.id]
      );
    }

    // 3) ridrejtim sipas platformës
 // 3) ridrejtim sipas platformës
const ua = req.headers["user-agent"] || "";
if (isAppleUA(ua)) {
  return res.redirect(302, `${ORIGIN}/apple-wallet/generate/${customer.id}`);
} else {
  return res.redirect(302, `${ORIGIN}/google-wallet/generate-link/${customer.id}`);
}

  } catch (err) {
    console.error("[register] error:", err);
    return res.status(500).send("Registration failed");
  }
});

module.exports = router;
