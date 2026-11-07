# WebTrack

A small web application for tracking employees' working time. You add people, start timers for them with a task description, stop them — and at any point you can see how much time everyone has logged over a selected period. The data lives in a local SQLite file and survives app restarts.

No auth, no roles, no build step — it's a demo project and it doesn't pretend to be more than that.

## What it does

- Employees: add, delete (along with their time entries), see who has a timer running right now
- Timer: start one with a task description, live ticking stopwatch, at most one active timer per employee
- Reports: entries and per-employee totals for today / this week / this month / a custom date range, with an employee filter; if nothing was tracked in the period, it says so
- Light and dark themes

## How to run

You need Node.js 22.5 or newer (it uses the built-in `node:sqlite` module).

```bash
npm install
npm start        # → http://localhost:3000
```

The database is created automatically at `data/timetrack.db`. If you feel like it: `PORT=8080`, `DB_PATH=/wherever/db`.

Tests:

```bash
npm test         # 13 tests: employees, timer lifecycle, reports, persistence
```

## How it was built

Most of the code was written by an AI agent (ZCode running GLM by Z.ai) — it had access to the terminal, files, and a browser, so it also ran the app and verified it live instead of just generating files. I used Haiku 5.5 and GPT 5.6 Terra as a second opinion: running the API design past them and arguing over UI decisions. My part of the process was deciding what we're building at all, choosing what it should look like, and manually checking every stage — quite often something that "passed the tests" didn't work in my hands.

A few prompts from the process, roughly in the order they happened:

- "Build from scratch a small web app for tracking employees' working time: adding employees, a timer with a task description, entries and totals per period, and the data must survive a restart. No auth."
- "Here's a screenshot of a design I like. Restyle the app to match it: light sidebar, dark stat cards, tables with a dark header."
- "Add tests for the main scenarios, including restarting the timer and an empty report."
- "Start the app, go through the whole flow in a browser — add an employee, start and stop a timer, open the reports — and fix whatever breaks."
- "How much memory does the server actually use? Measure the real process."

## Problems found along the way

All of these were caught by manual checking and tests:

1. **Ghost toast.** An empty dark notification pill was sitting in the corner even when there was no notification: the CSS rule `.toast { display: flex }` was overriding the browser's default `[hidden] { display: none }`. Fixed with an explicit `.toast[hidden] { display: none }`.

2. **Clock a second behind.** The clock in the header and the "how many timers are running" counter update once per second, and right after switching pages they sat empty for up to a second. Turned out it was enough to refresh them right after each render.

3. **Invisible button in dark theme.** The primary dark button blended into the dark card. Adjusted the colors for the dark theme.

4. **Database swap before the first launch.** I originally went with `better-sqlite3`, but on the brand-new Node 26 it has no prebuilt binaries — on any machine without a build toolchain the install would just fail. Switched to the built-in `node:sqlite`: almost the same API, and zero native dependencies.

## Known trade-offs

- An entry belongs to the day its timer *started* — a session crossing midnight counts fully towards yesterday. Fine for a demo.
- Task descriptions are optional, even though the task wording made them sound required. It's more pleasant to use this way, so I left it.
- You can't edit the description of a running timer — only stop it and start a new one.
