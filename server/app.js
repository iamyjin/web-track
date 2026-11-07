'use strict';

const path = require('node:path');
const express = require('express');

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// All timestamps are stored as ISO strings (UTC), so plain string
// comparison is enough to filter by period.
function toIsoBoundary(value, endOfDay = false) {
  if (value === undefined || value === null || value === '') return null;
  let date;
  if (DAY_RE.test(value)) {
    // "YYYY-MM-DD" expands to a full day in the server's timezone
    const [y, m, d] = value.split('-').map(Number);
    date = endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d);
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date.getTime())) throw httpError(400, `Invalid date: "${value}"`);
  return date.toISOString();
}

function intParam(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Adds duration to an entry: finished entries get `duration_ms`,
// running ones get `elapsed_ms` (time passed so far).
function withDuration(entry) {
  if (entry.ended_at) {
    return { ...entry, duration_ms: Date.parse(entry.ended_at) - Date.parse(entry.started_at) };
  }
  return { ...entry, elapsed_ms: Date.now() - Date.parse(entry.started_at) };
}

function buildApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  const queries = {
    listEmployees: db.prepare(`
      SELECT e.id, e.name, e.position, e.created_at,
             t.id AS active_entry_id, t.started_at AS active_started_at,
             t.description AS active_description
      FROM employees e
      LEFT JOIN time_entries t ON t.employee_id = e.id AND t.ended_at IS NULL
      ORDER BY e.name COLLATE NOCASE
    `),
    getEmployee: db.prepare('SELECT * FROM employees WHERE id = ?'),
    insertEmployee: db.prepare('INSERT INTO employees (name, position, created_at) VALUES (?, ?, ?)'),
    deleteEmployee: db.prepare('DELETE FROM employees WHERE id = ?'),
    listEntries: db.prepare(`
      SELECT t.*, e.name AS employee_name
      FROM time_entries t
      JOIN employees e ON e.id = t.employee_id
      WHERE (? IS NULL OR t.started_at >= ?)
        AND (? IS NULL OR t.started_at <= ?)
      ORDER BY t.started_at DESC
    `),
    getEntry: db.prepare(`
      SELECT t.*, e.name AS employee_name
      FROM time_entries t
      JOIN employees e ON e.id = t.employee_id
      WHERE t.id = ?
    `),
    runningEntry: db.prepare('SELECT * FROM time_entries WHERE employee_id = ? AND ended_at IS NULL'),
    insertEntry: db.prepare('INSERT INTO time_entries (employee_id, description, started_at) VALUES (?, ?, ?)'),
    stopEntry: db.prepare('UPDATE time_entries SET ended_at = ? WHERE id = ? AND ended_at IS NULL'),
  };

  const wrap = (fn) => (req, res, next) => {
    try {
      fn(req, res);
    } catch (err) {
      next(err);
    }
  };

  app.get('/api/employees', wrap((req, res) => {
    res.json(queries.listEmployees.all());
  }));

  app.post('/api/employees', wrap((req, res) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const position = typeof req.body.position === 'string' ? req.body.position.trim() : '';
    if (!name) throw httpError(400, 'Employee name is required');
    if (name.length > 80 || position.length > 80) throw httpError(400, 'Name and position are limited to 80 characters');
    const info = queries.insertEmployee.run(name, position, new Date().toISOString());
    res.status(201).json(queries.getEmployee.get(Number(info.lastInsertRowid)));
  }));

  app.delete('/api/employees/:id', wrap((req, res) => {
    const id = intParam(req.params.id);
    const employee = id && queries.getEmployee.get(id);
    if (!employee) throw httpError(404, 'Employee not found');
    queries.deleteEmployee.run(id); // time entries go away via ON DELETE CASCADE
    res.status(204).end();
  }));

  app.get('/api/time-entries', wrap((req, res) => {
    const from = toIsoBoundary(req.query.from);
    const to = toIsoBoundary(req.query.to, true);
    let entries = queries.listEntries.all(from, from, to, to);
    const employeeId = req.query.employee_id ? intParam(req.query.employee_id) : null;
    if (req.query.employee_id && !employeeId) throw httpError(400, 'Invalid employee_id');
    if (employeeId) entries = entries.filter((e) => e.employee_id === employeeId);
    res.json(entries.map(withDuration));
  }));

  // Start a timer: creates a new running (not yet stopped) entry.
  app.post('/api/time-entries', wrap((req, res) => {
    const employeeId = req.body.employee_id === undefined ? null : intParam(req.body.employee_id);
    if (!employeeId) throw httpError(400, 'employee_id is required');
    const employee = queries.getEmployee.get(employeeId);
    if (!employee) throw httpError(404, 'Employee not found');
    if (queries.runningEntry.get(employeeId)) throw httpError(409, 'This employee already has a running timer');
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    if (description.length > 200) throw httpError(400, 'Description is limited to 200 characters');
    const info = queries.insertEntry.run(employeeId, description, new Date().toISOString());
    res.status(201).json(withDuration(queries.getEntry.get(Number(info.lastInsertRowid))));
  }));

  // Stop a running timer.
  app.post('/api/time-entries/:id/stop', wrap((req, res) => {
    const id = intParam(req.params.id);
    const entry = id && queries.getEntry.get(id);
    if (!entry) throw httpError(404, 'Time entry not found');
    if (entry.ended_at) throw httpError(409, 'This timer is already stopped');
    queries.stopEntry.run(new Date().toISOString(), id);
    res.json(withDuration(queries.getEntry.get(id)));
  }));

  // Totals per employee for a period. Entries are attributed to the day they
  // started; running timers are counted with the elapsed time so far.
  app.get('/api/report', wrap((req, res) => {
    const from = toIsoBoundary(req.query.from);
    const to = toIsoBoundary(req.query.to, true);
    let entries = queries.listEntries.all(from, from, to, to).map(withDuration);

    const employeeId = req.query.employee_id ? intParam(req.query.employee_id) : null;
    if (req.query.employee_id && !employeeId) throw httpError(400, 'Invalid employee_id');
    if (employeeId) entries = entries.filter((e) => e.employee_id === employeeId);

    const totals = new Map();
    for (const emp of queries.listEmployees.all()) {
      if (employeeId && emp.id !== employeeId) continue;
      totals.set(emp.id, { id: emp.id, name: emp.name, sessions: 0, total_ms: 0 });
    }
    for (const entry of entries) {
      const row = totals.get(entry.employee_id);
      if (!row) continue;
      row.sessions += 1;
      row.total_ms += entry.duration_ms ?? entry.elapsed_ms;
    }

    res.json({
      from,
      to,
      entries,
      employees: [...totals.values()],
      grand_total_ms: [...totals.values()].reduce((sum, r) => sum + r.total_ms, 0),
    });
  }));

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Internal error' });
  });

  return app;
}

module.exports = { buildApp };
