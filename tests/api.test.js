'use strict';

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const request = require('supertest');
const { openDb } = require('../server/db');
const { buildApp } = require('../server/app');

// Each test gets a fresh app on its own temporary database file.
function makeApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-track-'));
  const db = openDb(path.join(dir, 'test.db'));
  return { db, app: buildApp(db) };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const addEmployee = (app, name, position = '') =>
  request(app).post('/api/employees').send({ name, position });

const startTimer = (app, employeeId, description = '') =>
  request(app).post('/api/time-entries').send({ employee_id: employeeId, description });

const stopTimer = (app, entryId) =>
  request(app).post(`/api/time-entries/${entryId}/stop`);

let ctx;

beforeEach(() => {
  ctx = makeApp();
});

afterEach(() => {
  ctx.db.close();
});

describe('employees', () => {
  test('adds an employee and lists them', async () => {
    const created = await addEmployee(ctx.app, 'Ada Lovelace', 'Mathematician');
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'Ada Lovelace', position: 'Mathematician' });
    expect(created.body.id).toBeGreaterThan(0);

    const list = await request(ctx.app).get('/api/employees');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe('Ada Lovelace');
  });

  test('rejects an employee without a name', async () => {
    const res = await addEmployee(ctx.app, '   ');
    expect(res.status).toBe(400);
  });

  test('deleting an employee removes their time entries too', async () => {
    const emp = (await addEmployee(ctx.app, 'Alan Turing')).body;
    const entry = (await startTimer(ctx.app, emp.id, 'Enigma')).body;
    await stopTimer(ctx.app, entry.id);

    const deleted = await request(ctx.app).delete(`/api/employees/${emp.id}`);
    expect(deleted.status).toBe(204);

    const entries = await request(ctx.app).get('/api/time-entries');
    expect(entries.body).toHaveLength(0);
    const employees = await request(ctx.app).get('/api/employees');
    expect(employees.body).toHaveLength(0);
  });
});

describe('timer', () => {
  test('starts and stops a timer with a task description', async () => {
    const emp = (await addEmployee(ctx.app, 'Grace Hopper', 'Rear Admiral')).body;

    const started = await startTimer(ctx.app, emp.id, 'Fix login bug');
    expect(started.status).toBe(201);
    expect(started.body.description).toBe('Fix login bug');
    expect(started.body.ended_at).toBeNull();

    await sleep(25);
    const stopped = await stopTimer(ctx.app, started.body.id);
    expect(stopped.status).toBe(200);
    expect(stopped.body.ended_at).not.toBeNull();
    expect(stopped.body.duration_ms).toBeGreaterThanOrEqual(25);
  });

  test('rejects a second timer while one is already running', async () => {
    const emp = (await addEmployee(ctx.app, 'Joan Clarke')).body;
    await startTimer(ctx.app, emp.id, 'First task');

    const second = await startTimer(ctx.app, emp.id, 'Second task');
    expect(second.status).toBe(409);
  });

  test('restarts the timer: stop, then start a new session', async () => {
    const emp = (await addEmployee(ctx.app, 'Katherine Johnson')).body;

    const first = await startTimer(ctx.app, emp.id, 'Session one');
    await sleep(25);
    const stopFirst = await stopTimer(ctx.app, first.body.id);
    expect(stopFirst.status).toBe(200);

    // the same employee starts a new session right after stopping
    const second = await startTimer(ctx.app, emp.id, 'Session two');
    expect(second.status).toBe(201);
    expect(second.body.id).not.toBe(first.body.id);
    await sleep(25);
    const stopSecond = await stopTimer(ctx.app, second.body.id);
    expect(stopSecond.status).toBe(200);

    const entries = await request(ctx.app).get('/api/time-entries');
    expect(entries.body).toHaveLength(2);
    expect(entries.body.every((e) => e.ended_at)).toBe(true);
    expect(entries.body.map((e) => e.description).sort()).toEqual(['Session one', 'Session two']);
  });

  test('rejects stopping an already stopped timer', async () => {
    const emp = (await addEmployee(ctx.app, 'Mary Jackson')).body;
    const entry = (await startTimer(ctx.app, emp.id, 'Task')).body;
    await stopTimer(ctx.app, entry.id);

    const again = await stopTimer(ctx.app, entry.id);
    expect(again.status).toBe(409);
  });

  test('rejects a timer for a missing employee', async () => {
    const res = await startTimer(ctx.app, 9999, 'Ghost task');
    expect(res.status).toBe(404);
  });
});

describe('report', () => {
  test('totals time per employee for a selected period', async () => {
    const alice = (await addEmployee(ctx.app, 'Alice')).body;
    const bob = (await addEmployee(ctx.app, 'Bob')).body;

    const e1 = (await startTimer(ctx.app, alice.id, 'Task 1')).body;
    await sleep(25);
    await stopTimer(ctx.app, e1.id);
    const e2 = (await startTimer(ctx.app, alice.id, 'Task 2')).body;
    await sleep(25);
    await stopTimer(ctx.app, e2.id);
    const e3 = (await startTimer(ctx.app, bob.id, 'Task 3')).body;
    await sleep(25);
    await stopTimer(ctx.app, e3.id);

    const from = new Date(Date.now() - 60_000).toISOString();
    const to = new Date(Date.now() + 60_000).toISOString();
    const res = await request(ctx.app).get(`/api/report?from=${from}&to=${to}`);

    expect(res.status).toBe(200);
    const rows = new Map(res.body.employees.map((r) => [r.id, r]));
    expect(rows.get(alice.id).sessions).toBe(2);
    expect(rows.get(alice.id).total_ms).toBeGreaterThanOrEqual(50);
    expect(rows.get(bob.id).sessions).toBe(1);
    expect(res.body.grand_total_ms).toBe(rows.get(alice.id).total_ms + rows.get(bob.id).total_ms);
    expect(res.body.entries).toHaveLength(3);
  });

  test('returns an empty report for a period without records', async () => {
    const emp = (await addEmployee(ctx.app, 'Carol')).body;
    const entry = (await startTimer(ctx.app, emp.id, 'Today only')).body;
    await stopTimer(ctx.app, entry.id);

    // a period long before any records exist
    const res = await request(ctx.app).get('/api/report?from=2020-01-01T00:00:00.000Z&to=2020-01-02T00:00:00.000Z');
    expect(res.status).toBe(200);
    expect(res.body.entries).toEqual([]);
    expect(res.body.grand_total_ms).toBe(0);
    expect(res.body.employees).toEqual([{ id: emp.id, name: 'Carol', sessions: 0, total_ms: 0 }]);
  });

  test('filters the report by employee', async () => {
    const a = (await addEmployee(ctx.app, 'Dave')).body;
    const b = (await addEmployee(ctx.app, 'Erin')).body;
    const e = (await startTimer(ctx.app, a.id, 'Only Dave works')).body;
    await stopTimer(ctx.app, e.id);

    const res = await request(ctx.app).get(`/api/report?employee_id=${a.id}`);
    expect(res.body.employees).toHaveLength(1);
    expect(res.body.employees[0].id).toBe(a.id);
    expect(res.body.entries.every((en) => en.employee_id === a.id)).toBe(true);
    expect(b).toBeDefined();
  });

  test('rejects an invalid period', async () => {
    const res = await request(ctx.app).get('/api/report?from=not-a-date');
    expect(res.status).toBe(400);
  });
});

describe('persistence across app restart', () => {
  test('keeps employees, entries and running timers after reopening the database', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-track-restart-'));
    const dbFile = path.join(dir, 'app.db');

    // first "run" of the application
    const firstDb = openDb(dbFile);
    const firstApp = buildApp(firstDb);
    const emp = (await addEmployee(firstApp, 'Dorothy Vaughan', 'Supervisor')).body;
    const running = (await startTimer(firstApp, emp.id, 'Orbital calculations')).body;
    firstDb.close();

    // second "run": a new app instance on the same database file
    const secondDb = openDb(dbFile);
    const secondApp = buildApp(secondDb);

    const employees = await request(secondApp).get('/api/employees');
    expect(employees.body).toHaveLength(1);
    expect(employees.body[0]).toMatchObject({
      id: emp.id,
      name: 'Dorothy Vaughan',
      position: 'Supervisor',
      active_entry_id: running.id,
    });

    // the timer that survived the restart can still be stopped
    const stopped = await stopTimer(secondApp, running.id);
    expect(stopped.status).toBe(200);

    const report = await request(secondApp).get(`/api/report?from=${new Date(Date.now() - 60_000).toISOString()}`);
    expect(report.body.employees[0].sessions).toBe(1);
    expect(report.body.employees[0].total_ms).toBeGreaterThanOrEqual(0);

    secondDb.close();
  });
});
