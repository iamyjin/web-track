/* WebTrack — frontend. Plain JS, no build step.
   Pages: #/ (dashboard with timers), #/employees, #/reports. */

const $ = (sel, root = document) => root.querySelector(sel);

/* ---------- icons (inline SVG, feather-style) ---------- */

const ICONS = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  play: '<polygon points="6 4 20 12 6 20 6 4"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
  coin: '<circle cx="12" cy="12" r="9"/><text x="12" y="16" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor" stroke="none">$</text>',
  trend: '<line x1="7" y1="17" x2="17" y2="7"/><polyline points="8 7 17 7 17 16"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
};

function icon(name, size = 18) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

const STOPWATCH = `
  <svg class="stopwatch" viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <line x1="84" y1="16" x2="116" y2="16"/>
    <line x1="100" y1="18" x2="100" y2="46"/>
    <line x1="147" y1="71" x2="163" y2="55"/>
    <circle cx="100" cy="118" r="66"/>
    <path d="M100 118 100 78"/>
    <path d="M100 118 128 130"/>
    <circle cx="100" cy="118" r="6" fill="currentColor" stroke="none"/>
  </svg>`;

const SPARKLE = '<svg class="ic" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2Z"/></svg>';

/* ---------- tiny helpers ---------- */

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const fmt = {
  // 1:04:09 — used for live ticking timers
  hms(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },
  // 2h 05m / 5m 30s / 45s — used in tables and stat cards
  human(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
    if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  },
  stat(ms) { return ms ? fmt.human(ms) : '0h'; },
  date(iso) { return new Date(iso).toLocaleDateString([], { day: '2-digit', month: 'short' }); },
  time(iso) { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); },
};

const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dayEnd = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const isoDateInput = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

/* ---------- state ---------- */

const state = {
  route: 'dashboard',
  employees: [],
  preselect: null,      // employee to select on the dashboard after quick-start
  reportPreset: 'today', // today | week | month | custom
  customFrom: dayStart(new Date()),
  customTo: new Date(),
  reportEmployee: '',
};

let renderSeq = 0;

function rangeFromState() {
  const now = new Date();
  if (state.reportPreset === 'week') {
    const from = dayStart(now);
    from.setDate(from.getDate() - ((from.getDay() + 6) % 7)); // Monday
    return { from, to: now };
  }
  if (state.reportPreset === 'month') return { from: dayStart(new Date(now.getFullYear(), now.getMonth(), 1)), to: now };
  if (state.reportPreset === 'custom') return { from: state.customFrom, to: state.customTo };
  return { from: dayStart(now), to: now }; // today
}

/* ---------- toast ---------- */

let toastTimer;
function toast(message, kind = 'ok') {
  const el = $('#toast');
  el.hidden = false;
  el.className = kind === 'err' ? 'toast toast-err' : 'toast';
  el.innerHTML = `${icon(kind === 'err' ? 'alert' : 'check', 16)}<span>${esc(message)}</span>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3400);
}

/* ---------- router ---------- */

const ROUTES = {
  dashboard: renderDashboard,
  employees: renderEmployees,
  reports: renderReports,
};

function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (hash.startsWith('employees')) return 'employees';
  if (hash.startsWith('reports')) return 'reports';
  return 'dashboard';
}

function renderNav() {
  const items = [
    { id: 'dashboard', href: '#/', label: 'Dashboard', ic: 'home' },
    { id: 'employees', href: '#/employees', label: 'Employees', ic: 'users' },
    { id: 'reports', href: '#/reports', label: 'Reports', ic: 'chart' },
  ];
  $('#nav').innerHTML = items.map((it) =>
    `<a class="nav-item${it.id === state.route ? ' active' : ''}" href="${it.href}">${icon(it.ic)}<span>${it.label}</span></a>`).join('');
}

async function renderRoute() {
  state.route = currentRoute();
  renderNav();
  const seq = ++renderSeq;
  try {
    await ROUTES[state.route](seq);
    tick(); // fill clocks/running counts rendered after the previous tick
  } catch (err) {
    if (seq === renderSeq) {
      $('#view').innerHTML = `<div class="card empty" style="margin-top:24px"><b>Something went wrong</b><span>${esc(err.message)}</span></div>`;
    }
  }
}

/* ---------- shared fragments ---------- */

const chipRunning = '<span class="chip-running"><span class="pulse-dot"></span>Running</span>';

function statBlock({ ic, label, value, note, small }) {
  return `
    <div class="stat">
      <div class="stat-top"><span class="stat-label">${icon(ic, 16)}${esc(label)}</span><span class="stat-chip">${icon('trend', 14)}</span></div>
      <div class="stat-value">${esc(value)}${small ? `<small>${esc(small)}</small>` : ''}</div>
      <div class="stat-note" title="${esc(note)}">${esc(note)}</div>
    </div>`;
}

function emptyState(title, text, link) {
  return `
    <div class="empty">
      ${STOPWATCH}
      <b>${esc(title)}</b>
      <span>${esc(text)}</span>
      ${link ? `<a class="empty-link" href="${link.href}">${esc(link.label)}</a>` : ''}
    </div>`;
}

function pageHead(title, sub, rightHtml) {
  return `
    <div class="page-head">
      <div>
        <h1>${esc(title)}</h1>
        <div class="page-sub">${icon('clock', 14)}<span class="js-clock"></span><span class="sep">·</span><span class="js-running-count"></span>${sub ? `<span class="sep">·</span><span>${sub}</span>` : ''}</div>
      </div>
      ${rightHtml || ''}
    </div>`;
}

/* ---------- dashboard ---------- */

async function renderDashboard(seq) {
  const weekFrom = rangeFromState.call({ reportPreset: 'week' });
  const [employees, week] = await Promise.all([
    api('/api/employees'),
    api(`/api/report?from=${encodeURIComponent(weekFrom.from.toISOString())}`),
  ]);
  if (seq !== renderSeq) return;
  state.employees = employees;

  const todayStartMs = Date.parse(dayStart(new Date()));
  let todayMs = 0;
  let weekMs = 0;
  for (const e of week.entries) {
    const ms = e.duration_ms ?? e.elapsed_ms;
    if (Date.parse(e.started_at) >= todayStartMs) todayMs += ms;
    weekMs += ms;
  }

  const running = employees.filter((e) => e.active_entry_id);
  const hasEmployees = employees.length > 0;

  const employeeOptions = hasEmployees
    ? employees.map((e) => `<option value="${e.id}" ${state.preselect === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')
    : '<option value="">No employees yet</option>';

  const runningHtml = running.length
    ? running.map((r) => `
        <div class="running-row">
          <span class="pulse-dot"></span>
          <div class="running-info">
            <b>${esc(r.name)}</b>
            <span>${r.active_description ? esc(r.active_description) : '<i class="muted">No description</i>'}</span>
          </div>
          <span class="running-time" data-elapsed-ms="${Date.parse(r.active_started_at)}">${fmt.hms(Date.now() - Date.parse(r.active_started_at))}</span>
          <button class="btn btn-small btn-ghost" data-stop="${r.active_entry_id}">${icon('stop', 13)}Stop</button>
        </div>`).join('')
    : '<div class="running-empty">No timers running right now — start one above.</div>';

  const runningNames = running.map((r) => r.name);
  const runningNote = runningNames.length
    ? (runningNames.length > 2 ? `${runningNames.slice(0, 2).join(', ')} +${runningNames.length - 2} more` : runningNames.join(', '))
    : 'nobody is tracking right now';

  $('#view').innerHTML = `
    ${pageHead('Dashboard', '', `
      <div class="banner">
        <span class="banner-icon">${icon('coin', 19)}</span>
        <b>${fmt.stat(todayMs)}</b>
        <span class="banner-muted">tracked today · whole team</span>
      </div>`)}
    <div class="dash-grid">
      <section class="card timer-card">
        <div class="timer-hero">
          ${SPARKLE.replace('class="ic"', 'class="sparkle s1"')}
          ${SPARKLE.replace('class="ic"', 'class="sparkle s2"')}
          ${SPARKLE.replace('class="ic"', 'class="sparkle s3"')}
          ${STOPWATCH}
        </div>
        <form class="timer-form" id="timer-form">
          <label class="field"><span>Employee</span>
            <select id="timer-employee" ${hasEmployees ? '' : 'disabled'}>${employeeOptions}</select>
          </label>
          <label class="field"><span>Task description <i>optional</i></span>
            <input id="timer-description" maxlength="200" placeholder="What are you working on?" ${hasEmployees ? '' : 'disabled'} autocomplete="off">
          </label>
          <button class="btn btn-dark btn-block" type="submit" ${hasEmployees ? '' : 'disabled'}>${icon('play', 16)}Start timer</button>
        </form>
        <div class="running">${runningHtml}</div>
      </section>
      <aside class="stats-panel">
        ${statBlock({ ic: 'coin', label: 'Tracked today', value: fmt.stat(todayMs), note: 'all employees combined' })}
        ${statBlock({ ic: 'zap', label: 'Running now', value: String(running.length), note: runningNote })}
        ${statBlock({ ic: 'chart', label: 'This week', value: fmt.stat(weekMs), note: 'since Monday' })}
      </aside>
    </div>`;

  state.preselect = null;
  if (hasEmployees) $('#timer-description').focus();
}

/* ---------- employees ---------- */

async function renderEmployees(seq) {
  const todayFrom = dayStart(new Date());
  const [employees, today] = await Promise.all([
    api('/api/employees'),
    api(`/api/report?from=${encodeURIComponent(todayFrom.toISOString())}`),
  ]);
  if (seq !== renderSeq) return;
  state.employees = employees;

  const totalsById = new Map(today.employees.map((r) => [r.id, r]));
  const runningCount = employees.filter((e) => e.active_entry_id).length;

  const rows = employees.map((e) => {
    const total = totalsById.get(e.id);
    return `
      <tr>
        <td><div class="cell-emp"><span class="avatar">${esc(initials(e.name))}</span><b>${esc(e.name)}</b></div></td>
        <td class="muted">${e.position ? esc(e.position) : '—'}</td>
        <td>${e.active_entry_id ? chipRunning : '<span class="muted">—</span>'}</td>
        <td><b>${fmt.stat(total ? total.total_ms : 0)}</b></td>
        <td>
          <div class="cell-actions">
            ${e.active_entry_id
              ? `<button class="btn btn-small btn-ghost" data-stop="${e.active_entry_id}">${icon('stop', 13)}Stop</button>`
              : `<button class="btn btn-small btn-ghost" data-quickstart="${e.id}">${icon('play', 13)}Start</button>`}
            <button class="btn btn-small btn-ghost" data-del="${e.id}" title="Delete employee">${icon('trash', 13)}</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  $('#view').innerHTML = `
    ${pageHead('Employees', `${employees.length} on the team`)}
    <div class="emp-grid">
      <section class="card form-card">
        <h2>Add employee</h2>
        <form id="employee-form" class="field" style="gap:14px">
          <label class="field"><span>Name</span>
            <input id="emp-name" maxlength="80" placeholder="e.g. Ada Lovelace" autocomplete="off">
          </label>
          <label class="field"><span>Position <i>optional</i></span>
            <input id="emp-position" maxlength="80" placeholder="e.g. Backend developer" autocomplete="off">
          </label>
          <button class="btn btn-dark btn-block" type="submit">${icon('userPlus', 16)}Add employee</button>
        </form>
      </section>
      <section class="card table-card">
        ${employees.length ? `
          <div class="table-head-row"><h2>Team</h2><span class="muted">${runningCount ? `${runningCount} timer${runningCount > 1 ? 's' : ''} running` : 'no timers running'}</span></div>
          <div class="table-scroll">
            <table class="table">
              <thead><tr><th>Employee</th><th>Position</th><th>Status</th><th>Today</th><th class="th-right">Actions</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>` : emptyState('No employees yet', 'Add the first member of your team with the form.')}
      </section>
    </div>`;
}

/* ---------- reports ---------- */

async function renderReports(seq) {
  const range = rangeFromState();
  const params = new URLSearchParams({ from: range.from.toISOString(), to: range.to.toISOString() });
  if (state.reportEmployee) params.set('employee_id', state.reportEmployee);

  const [report, employees] = await Promise.all([api(`/api/report?${params}`), api('/api/employees')]);
  if (seq !== renderSeq) return;
  state.employees = employees;

  // drop a stale filter if that employee was deleted
  if (state.reportEmployee && !employees.some((e) => e.id === Number(state.reportEmployee))) {
    state.reportEmployee = '';
  }

  const presets = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This week' },
    { id: 'month', label: 'This month' },
  ];
  const tabs = presets.map((p) =>
    `<button type="button" class="tab${state.reportPreset === p.id ? ' active' : ''}" data-preset="${p.id}">${p.label}</button>`).join('');

  const totalsRows = employees.length
    ? [...report.employees].sort((a, b) => b.total_ms - a.total_ms).map((r) => `
        <tr>
          <td><div class="cell-emp"><span class="avatar">${esc(initials(r.name))}</span><b>${esc(r.name)}</b></div></td>
          <td>${r.sessions}</td>
          <td class="td-right"><b>${fmt.stat(r.total_ms)}</b></td>
        </tr>`).join('')
    : '';

  const entriesRows = report.entries.map((e) => `
    <tr>
      <td><b>${esc(e.employee_name)}</b></td>
      <td class="muted">${e.description ? esc(e.description) : 'No description'}</td>
      <td>${fmt.date(e.started_at)}</td>
      <td>${fmt.time(e.started_at)}</td>
      <td>${e.ended_at ? fmt.time(e.ended_at) : chipRunning}</td>
      <td class="td-right">${e.ended_at
        ? fmt.human(e.duration_ms)
        : `<span data-elapsed-ms="${Date.parse(e.started_at)}">${fmt.hms(Date.now() - Date.parse(e.started_at))}</span>`}</td>
    </tr>`).join('');

  const periodText = state.reportPreset === 'today'
    ? fmt.date(range.from.toISOString())
    : `${fmt.date(range.from.toISOString())} – ${fmt.date(range.to.toISOString())}`;

  $('#view').innerHTML = `
    ${pageHead('Reports', 'records and totals for a selected period')}
    <section class="card controls-card">
      <div class="tabs">${tabs}</div>
      <div class="controls-right">
        <label class="field field-inline"><span>From</span><input type="date" id="report-from" value="${isoDateInput(range.from)}"></label>
        <label class="field field-inline"><span>To</span><input type="date" id="report-to" value="${isoDateInput(range.to)}"></label>
        <label class="field field-inline"><span>Employee</span>
          <select id="report-employee">
            <option value="">All employees</option>
            ${employees.map((e) => `<option value="${e.id}" ${String(e.id) === String(state.reportEmployee) ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
          </select>
        </label>
      </div>
    </section>

    <div class="report-grid">
      <section class="card table-card">
        <div class="table-head-row"><h2>Total by employee</h2><span class="muted">${esc(periodText)}</span></div>
        ${employees.length ? `
          <div class="table-scroll">
            <table class="table">
              <thead><tr><th>Employee</th><th>Sessions</th><th class="th-right">Total</th></tr></thead>
              <tbody>${totalsRows}</tbody>
            </table>
          </div>` : emptyState('No employees yet', 'Add employees and start timers to see totals here.', { href: '#/employees', label: 'Go to Employees' })}
      </section>
      <aside class="stats-panel">
        ${statBlock({
          ic: 'coin',
          label: 'Grand total',
          value: fmt.stat(report.grand_total_ms),
          note: `${report.entries.length} session${report.entries.length === 1 ? '' : 's'} · ${esc(periodText)}`,
        })}
      </aside>
    </div>

    <section class="card table-card">
      <div class="table-head-row"><h2>Records</h2><span class="muted">${report.entries.length} entr${report.entries.length === 1 ? 'y' : 'ies'}</span></div>
      ${report.entries.length ? `
        <div class="table-scroll">
          <table class="table">
            <thead><tr><th>Employee</th><th>Task</th><th>Date</th><th>Start</th><th>End</th><th class="th-right">Duration</th></tr></thead>
            <tbody>${entriesRows}</tbody>
          </table>
        </div>` : emptyState('No records for this period', 'Try another period, or start a timer on the Dashboard.', { href: '#/', label: 'Go to Dashboard' })}
    </section>

    <div class="note-card">${icon('info', 18)}<div><b>Note.</b> Totals include timers that are still running (counted up to now). Each record belongs to the day it started.</div></div>`;
}

/* ---------- events ---------- */

async function onViewClick(e) {
  const stopBtn = e.target.closest('[data-stop]');
  if (stopBtn) {
    try {
      const stopped = await api(`/api/time-entries/${stopBtn.dataset.stop}/stop`, { method: 'POST' });
      toast(`Timer stopped · ${fmt.human(stopped.duration_ms)}`);
      renderRoute();
    } catch (err) { toast(err.message, 'err'); }
    return;
  }

  const quick = e.target.closest('[data-quickstart]');
  if (quick) {
    state.preselect = Number(quick.dataset.quickstart);
    if (state.route === 'dashboard') renderRoute(); else location.hash = '#/';
    return;
  }

  const tab = e.target.closest('[data-preset]');
  if (tab) {
    state.reportPreset = tab.dataset.preset;
    renderRoute();
    return;
  }

  const del = e.target.closest('[data-del]');
  if (del) {
    if (del.dataset.armed) {
      try {
        await api(`/api/employees/${del.dataset.del}`, { method: 'DELETE' });
        toast('Employee deleted');
        renderRoute();
      } catch (err) { toast(err.message, 'err'); }
    } else {
      del.dataset.armed = '1';
      del.classList.add('btn-danger');
      del.textContent = 'Sure?';
      setTimeout(() => {
        if (document.contains(del)) {
          delete del.dataset.armed;
          del.classList.remove('btn-danger');
          del.innerHTML = icon('trash', 13);
        }
      }, 2600);
    }
  }
}

async function onSubmit(e) {
  e.preventDefault();

  if (e.target.id === 'timer-form') {
    const select = $('#timer-employee');
    if (!select.value) return;
    try {
      await api('/api/time-entries', {
        method: 'POST',
        body: { employee_id: Number(select.value), description: $('#timer-description').value.trim() },
      });
      toast('Timer started');
      renderRoute();
    } catch (err) { toast(err.message, 'err'); }
  }

  if (e.target.id === 'employee-form') {
    const nameInput = $('#emp-name');
    const name = nameInput.value.trim();
    const position = $('#emp-position').value.trim();
    if (!name) { toast('Enter a name', 'err'); nameInput.focus(); return; }
    try {
      await api('/api/employees', { method: 'POST', body: { name, position } });
      toast(`Employee “${name}” added`);
      renderRoute();
    } catch (err) { toast(err.message, 'err'); }
  }
}

function onChange(e) {
  if (e.target.id === 'report-employee') {
    state.reportEmployee = e.target.value;
    renderRoute();
    return;
  }
  if (e.target.id === 'report-from' && e.target.value) {
    state.customFrom = dayStart(new Date(`${e.target.value}T00:00:00`));
    state.reportPreset = 'custom';
    renderRoute();
  }
  if (e.target.id === 'report-to' && e.target.value) {
    state.customTo = dayEnd(new Date(`${e.target.value}T00:00:00`));
    state.reportPreset = 'custom';
    renderRoute();
  }
}

/* ---------- live tick: elapsed timers, clock, running count ---------- */

function tick() {
  const now = Date.now();
  document.querySelectorAll('[data-elapsed-ms]').forEach((el) => {
    el.textContent = fmt.hms(now - Number(el.dataset.elapsedMs));
  });
  const clock = new Date().toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  document.querySelectorAll('.js-clock').forEach((el) => { el.textContent = clock; });
  const runningCount = state.employees.filter((emp) => emp.active_entry_id).length;
  document.querySelectorAll('.js-running-count').forEach((el) => {
    el.textContent = runningCount ? `${runningCount} timer${runningCount > 1 ? 's' : ''} running` : 'no timers running';
  });
}

/* ---------- theme ---------- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('#btn-theme').innerHTML = icon(theme === 'dark' ? 'sun' : 'moon', 18);
}

/* ---------- boot ---------- */

function injectStatic() {
  $('.brand-badge').innerHTML = icon('clock', 18);
  $('#btn-top-add').innerHTML = `${icon('plus', 16)}<span>Add employee</span>`;
  $('#topbar-info').innerHTML = `${icon('info', 15)}<span class="js-clock"></span><span class="sep">·</span><span class="js-running-count"></span>`;
  $('#sidebar-note').innerHTML = `${icon('db', 15)}<span>Data is stored in a local SQLite file and survives app restarts.</span>`;
  $('#footer-right').innerHTML = `
    <span class="footer-check">${icon('check', 14)}SQLite storage</span>
    <span class="footer-check">${icon('check', 14)}Survives restarts</span>`;
}

function boot() {
  injectStatic();
  applyTheme(localStorage.getItem('webtrack-theme') || 'light');
  $('#btn-theme').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('webtrack-theme', next);
  });

  window.addEventListener('hashchange', renderRoute);
  $('#view').addEventListener('click', onViewClick);
  $('#view').addEventListener('submit', onSubmit);
  $('#view').addEventListener('change', onChange);

  setInterval(tick, 1000);
  renderRoute();
  tick();
}

boot();
