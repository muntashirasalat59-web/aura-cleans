// Shared database initialization logic

const fs = require('fs');
const path = require('path');

const REQUIRED_TABLES = ['products', 'parties', 'purchases', 'purchase_items', 'sales', 'sale_items'];

function getMissingTables(db) {
  const existing = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${REQUIRED_TABLES.map(() => '?').join(', ')})`)
    .all(...REQUIRED_TABLES)
    .map((row) => row.name);

  return REQUIRED_TABLES.filter((table) => !existing.includes(table));
}

function initializeDatabase(db) {
  const missingTables = getMissingTables(db);

  if (missingTables.length === 0) {
    return false;
  }

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  console.log('Database initialized. Created tables:', REQUIRED_TABLES.join(', '));
  return true;
}

module.exports = { initializeDatabase, getMissingTables, REQUIRED_TABLES };
