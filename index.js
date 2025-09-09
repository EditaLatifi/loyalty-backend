const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

const app = express();
app.use(express.static('public'));
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Auth
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Customers & Notifications
const customerRoutes = require('./routes/customers');
app.use('/api/customers', customerRoutes);

const notifRoutes = require('./routes/notifications');
app.use('/api/notifications', notifRoutes);

// Wallet integrations
const googleWalletRoutes = require('./routes/googleWallet');
app.use('/google-wallet', googleWalletRoutes);   // ✅ FIXED

const appleWalletRoutes = require("./routes/appleWallet");
app.use("/apple-wallet", appleWalletRoutes);     // ✅ only once

const walletRoutes = require('./routes/wallet');
app.use('/api/wallet', walletRoutes);            // ✅ only once

// Scan
const scanRoute = require('./routes/scan');
app.use('/api/scan', scanRoute);

// Cron jobs
require('./cron/adminTasks');
require('./cron/jobs');

// Admin
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Static wallet test page
app.use('/wallet.html', express.static(path.join(__dirname, 'wallet.html')));

// Root
app.get('/', (req, res) => {
  res.send('Loyalty backend running ✅');
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

