// routes/appleWallet.js
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { PKPass } = require("passkit-generator");
const pool = require("../config/db");

// ---- Konfigurimet e tua (vendosi në ENV në prod) ----
const PASS_TYPE_ID   = process.env.PASS_TYPE_ID   || "pass.com.loyalito.loyalty"; // p.sh. pass.com.by-bc.loyalty
const TEAM_ID        = process.env.TEAM_ID        || "VDT8R44NHT";             // Apple Developer Team ID
const WEB_SERVICE_URL= process.env.WEB_SERVICE_URL|| "https://by-bc.com/apple/v1";
const AUTH_TOKEN     = process.env.AUTH_TOKEN     || "super-secret-token";     // përdoret nga Apple device→server

// Rrugët e certifikatave (si i ke në projekt)
const WWDR_PEM      = path.join(__dirname, "../config/apple/WWDR.pem");
const SIGNER_CERT   = path.join(__dirname, "../config/apple/fullchain.pem");
const SIGNER_KEY    = path.join(__dirname, "../config/apple/WalletPass.key");
// nëse ke passphrase për key:
// const SIGNER_KEY_PASS = process.env.SIGNER_KEY_PASS || undefined;

function buildSerial(businessId, customerId) {
  // Serial duhet të jetë unik dhe stabil për atë përdorues
  return `biz-${businessId}-cust-${customerId}`;
}

router.get("/generate/:customerId", async (req, res) => {
  const { customerId } = req.params;

  try {
    // 1) Lexo të dhënat nga DB (emër, pikë, business)
    const { rows: custRows } = await pool.query(
      `SELECT c.id as customer_id, c.name, c.email, w.points, w.last_scanned, w.business_id,
              b.name AS business_name
       FROM customers c
       LEFT JOIN wallets w ON w.customer_id = c.id
       LEFT JOIN businesses b ON b.id = w.business_id
       WHERE c.id = $1
       LIMIT 1`,
      [customerId]
    );
    const c = custRows[0];
    if (!c) return res.status(404).json({ error: "Customer not found" });

    const serialNumber = buildSerial(c.business_id || 0, c.customer_id);
    const organizationName = c.business_name || "Your Business";
    const logoText = `${organizationName} Loyalty`;

    // 2) Krijo pass nga template
    const pass = await PKPass.from(
      {
        model: path.join(__dirname, "../config/apple/passTemplate.pass"),
        certificates: {
          wwdr: fs.readFileSync(WWDR_PEM),
          signerCert: fs.readFileSync(SIGNER_CERT),
          signerKey: fs.readFileSync(SIGNER_KEY),
          // signerKeyPassphrase: SIGNER_KEY_PASS, // nëse ke
        },
      },
      {
        // ---- Metadata bazë (E DOMOSDOSHME) ----
        formatVersion: 1,
        passTypeIdentifier: PASS_TYPE_ID,
        teamIdentifier: TEAM_ID,
        serialNumber,
        organizationName,
        description: "Loyalty Card",
        logoText,

        // Këto e aktivizojnë Apple Wallet Web Service në pajisje
        webServiceURL: WEB_SERVICE_URL,          // serveri yt p.sh. https://by-bc.com/apple/v1
        authenticationToken: AUTH_TOKEN,         // dërgohet nga iPhone në Authorization header

        // Ngjyrat / stili bazë (opsionale)
        backgroundColor: "rgb(0,0,0)",
        foregroundColor: "rgb(255,255,255)",
        labelColor: "rgb(255,215,0)",

        // Pass type – p.sh. storeCard, generic
        // Nëse template-i yt është p.sh. "storeCard", këto fusha shfaqen në face të kartës:
        storeCard: {
          primaryFields: [
            {
              key: "points",
              label: "POINTS",
              value: Number.isFinite(c.points) ? c.points : 0,
            },
          ],
          secondaryFields: [
            {
              key: "name",
              label: "Member",
              value: c.name || "Member",
            },
          ],
          auxiliaryFields: [
            {
              key: "last",
              label: "Last Scan",
              value: c.last_scanned ? new Date(c.last_scanned).toISOString().slice(0, 10) : "—",
            },
          ],
          backFields: [
            {
              key: "email",
              label: "Email",
              value: c.email || "—",
            },
            {
              key: "business",
              label: "Business",
              value: organizationName,
            },
          ],
        },
      }
    );

pass.barcodes = [
  {
    message: `${ORIGIN}/api/scan?serial=${serialNumber}&business_id=${c.business_id}`,
    format: "PKBarcodeFormatQR",
    messageEncoding: "iso-8859-1",
  }, 
    ];

    // 4) (opsionale) vendos një ikonë dinamike sipas business-it, etj.
    // p.sh. pass.addBuffer("logo.png", fs.readFileSync(pathToLogo));

    // 5) Shkarko kartën
    const buf = pass.getAsBuffer(); // ose: await pass.asBuffer()
    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader("Content-Disposition", `attachment; filename=loyalty-${c.customer_id}.pkpass`);
    res.setHeader("Content-Length", buf.length);
    return res.send(buf);
  } catch (err) {
    console.error("Apple Wallet error:", err);
    return res.status(500).json({ error: "Could not generate Apple Wallet pass" });
  }
});

module.exports = router;
