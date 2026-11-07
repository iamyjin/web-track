'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS employees (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  position   TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS time_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  started_at  TEXT NOT NULL,
  ended_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_entries_employee ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_entries_started  ON time_entries(started_at);
`;

// Opens (or creates) the SQLite database and applies the schema.
// A running timer is simply an entry with `ended_at = NULL`.
function openDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

module.exports = { openDb };
