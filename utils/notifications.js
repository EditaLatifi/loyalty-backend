const admin = require('firebase-admin');
const serviceAccount = require('../config/firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const sendPushNotification = async (token, title, body) => {
  const message = {
    token,
    notification: { title, body }
  };

  try {
    await admin.messaging().send(message);
  } catch (error) {
    console.error('FCM error:', error);
  }
};

module.exports = { sendPushNotification };
