// api/_db.js
const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('Variable de entorno POSTGRES_URL o DATABASE_URL no configurada.');
    }

    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

module.exports = { getPool };
