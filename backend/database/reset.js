// Delete database file and recreate all tables from scratch
// Command: npm run reset-db

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { initializeDatabase } = require('./setup');

const dbPath = path.join(__dirname, 'inventory.db');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('Removed existing database file.');
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
initializeDatabase(db);
db.close();

console.log('Database reset successfully!');
console.log('Location:', dbPath);
