// routes/appleWallet.js
const express = require("express");
const router = express.Router();
const path = require("path");
const { PKPass } = require("passkit-generator");
const fs = require("fs");

router.get("/generate/:customerId", async (req, res) => {
  const { customerId } = req.params;

  try {
    const pass = await PKPass.from(
      {
        model: path.join(__dirname, "../config/apple/passTemplate.pass"),
        certificates: {
          wwdr: fs.readFileSync(path.join(__dirname, "../config/apple/WWDR.pem")),
          signerCert: fs.readFileSync(path.join(__dirname, "../config/apple/fullchain.pem")),
          signerKey: fs.readFileSync(path.join(__dirname, "../config/apple/WalletPass.key")),
        },
      },
      {
        serialNumber: `cust-${customerId}`,
        description: "Loyalty Card",
        organizationName: "Pizzaiolo by B&C",
        logoText: "Pizzaiolo Loyalty",
      }
    );

    pass.barcodes = [
      {
        message: `LOYALTY-${customerId}`,
        format: "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1",
      },
    ];

    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader("Content-Disposition", `attachment; filename=loyalty-${customerId}.pkpass`);
    res.send(pass.getAsBuffer());
  } catch (err) {
    console.error("Apple Wallet error:", err);
    res.status(500).json({ error: "Could not generate Apple Wallet pass" });
  }
});

module.exports = router;
