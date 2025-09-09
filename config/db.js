const { Pool } = require('pg');
require('dotenv').config(); // make sure you load .env

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // uses the full URL from .env
  ssl: false // for local development, disable SSL
});

module.exports = pool;
