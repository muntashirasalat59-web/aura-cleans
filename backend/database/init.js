// Create database tables manually (optional — server auto-initializes on startup)
// Command: npm run init-db

const path = require('path');
const { initializeDatabase, REQUIRED_TABLES } = require('./setup');
const db = require('./db');

const created = initializeDatabase(db);

if (created) {
  console.log('Database created successfully!');
} else {
  console.log('Database already initialized — all tables exist.');
}

console.log('Location:', path.join(__dirname, 'inventory.db'));
console.log('Tables:', REQUIRED_TABLES.join(', '));

db.close();
