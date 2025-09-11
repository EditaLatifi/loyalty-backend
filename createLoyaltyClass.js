const { GoogleAuth } = require('google-auth-library');
const fetch = require('node-fetch');
const serviceAccount = require('./config/wallet-service-account.json');

const issuerId = '3388000000022946333'; // from Wallet Console (starts with 3388...)
const classId = `${issuerId}.loyalty_class`;

async function createClass() {
  try {
    const auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']
    });
    const client = await auth.getClient();

    const url = `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass`;
    const body = {
      id: classId,
      issuerName: "Pizzaiolo by B&C",
      programName: "Pizzaiolo Loyalty",
      reviewStatus: "underReview",
  programLogo: {
  sourceUri: {
    uri: "https://loyalty-backend-mu.vercel.app/logo.png"
  }
}

    };

    const res = await client.request({
      url,
      method: 'POST',
      data: body
    });

    console.log("✅ Loyalty Class created:", res.data);
  } catch (err) {
    console.error("❌ Failed to create loyalty class:", err.response?.data || err.message);
  }
}

createClass();
