'use strict';

const path = require('node:path');
const { openDb } = require('./db');
const { buildApp } = require('./app');

const port = Number(process.env.PORT) || 3000;
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'timetrack.db');

const db = openDb(dbPath);
const app = buildApp(db);

app.listen(port, () => {
  console.log(`WebTrack is running → http://localhost:${port}`);
  console.log(`Database: ${dbPath}`);
});

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
