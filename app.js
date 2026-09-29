const KEY = 'fga-crew-start-v1';
const ROLES = ['Helper', 'Driver', 'Crew lead', 'Office'];
const TASKS = [
  { id: 'offer-ack', day: 0, title: 'Offer accepted', body: 'Start date confirmed with the new hire.' },
  { id: 'emergency', day: 0, title: 'Emergency contact', body: 'Name and phone written down. Not stored in this repo.' },
  { id: 'docs-in', day: 0, title: 'Work papers in hand', body: 'They bring I-9 documents. A human files them. This app does not.' },
  { id: 'safety', day: 1, title: 'Safety briefing', body: 'Shop and job-site rules read out loud.' },
  { id: 'walk', day: 1, title: 'Yard / shop walk', body: 'Where tools live. Where they clock in.' },
  { id: 'clock', day: 1, title: 'First clock-in shown', body: 'TimeClock or paper. They tap once with you watching.' },
  { id: 'ppe', day: 1, title: 'PPE / uniform issued', body: 'What they take home. What stays in the truck.' },
  { id: 'tools', day: 1, title: 'Tools issued', body: 'List what left the cage.' },
  { id: 'shadow', day: 2, title: 'Shadow first job', body: 'They watch. They do not run the client conversation.' },
  { id: 'radio', day: 2, title: 'Comms / radio', body: 'Who they text when late. Who they never text.' },
  { id: 'client-rules', day: 2, title: 'Client-facing rules', body: 'Shoes off, no smoking, no photos of the house.' },
  { id: 'ride', day: 3, title: 'Ride / vehicle assignment', body: 'Who drives. Who rides. Keys stay a draft request.' },
  { id: 'supervised', day: 4, title: 'First supervised task', body: 'They do one real task. You stay on site.' },
  { id: 'policy-phone', day: 5, title: 'Phone / no-show policy', body: 'Ack. Timestamped. Not a legal filing.' },
  { id: 'policy-cash', day: 5, title: 'Cash and tips policy', body: 'Ack. Timestamped.' },
  { id: 'mgr-sign', day: 5, title: 'Manager first-week sign-off', body: 'You say they can run without a shadow.' }
];
const ACCESS = [
  { id: 'timeclock', title: 'TimeClock PIN', roles: ['all'] },
  { id: 'group-text', title: 'Crew group text', roles: ['all'] },
  { id: 'keys', title: 'Vehicle keys', roles: ['Driver', 'Crew lead'] },
  { id: 'email', title: 'Shop email', roles: ['Crew lead', 'Office'] },
  { id: 'drive', title: 'Job folder access', roles: ['Crew lead', 'Office'] },
  { id: 'admin', title: 'TimeClock admin', roles: ['Crew lead', 'Office'] }
];

const state = load();
let route = 'crew';
let hireId = null;
let deskUnlocked = !state.pinHash;

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && Array.isArray(raw.hires)) return raw;
  } catch {}
  return { shop: 'Crew Start', tag: 'First week. Then they can run.', pinHash: '', hires: [] };
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function uid() {
  return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function accessFor(role) {
  return ACCESS.filter((item) => item.roles.includes('all') || item.roles.includes(role));
}

function hireProgress(hire) {
  const done = TASKS.filter((task) => hire.tasks[task.id]).length;
  const openAccess = accessFor(hire.role).filter((item) => (hire.access[item.id] || 'draft') === 'draft').length;
  return { done, total: TASKS.length, openAccess };
}

function incomplete(hire) {
  const tasks = TASKS.filter((task) => !hire.tasks[task.id]);
  const access = accessFor(hire.role).filter((item) => (hire.access[item.id] || 'draft') === 'draft');
  return { tasks, access };
}

function fmtDay(n) {
  return n === 0 ? 'Day 0 · Offer' : 'Day ' + n;
}

function today() {
  return new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function el(html) {
  const wrap = document.createElement('div');
  wrap.innerHTML = html.trim();
  return wrap.firstElementChild;
}

function render() {
  document.getElementById('shop-name').textContent = state.shop || 'Crew Start';
  document.getElementById('shop-tag').textContent = state.tag || 'First week. Then they can run.';
  document.getElementById('bar-date').textContent = today();
  document.querySelectorAll('.tabs button').forEach((btn) => {
    btn.setAttribute('aria-current', btn.dataset.route === route ? 'page' : 'false');
  });
  const view = document.getElementById('view');
  view.replaceChildren();
  if (route === 'crew') view.append(viewCrew());
  if (route === 'hire') view.append(viewHire());
  if (route === 'desk') view.append(viewDesk());
  if (route === 'settings') view.append(viewSettings());
}

function viewCrew() {
  const box = el('<section></section>');
  box.append(el('<h2>Crew</h2>'));
  if (!state.hires.length) {
    box.append(el('<p class="empty">Add the first hire. Day one starts here.</p>'));
  } else {
    const list = el('<div class="stack"></div>');
    state.hires.forEach((hire) => {
      const { done, total, openAccess } = hireProgress(hire);
      const card = el(`<article class="card"><div class="row"><div><h4></h4><p></p></div><div class="meta"></div></div></article>`);
      card.querySelector('h4').textContent = hire.name;
      card.querySelector('p').textContent = hire.role + (hire.start ? ' · starts ' + hire.start : '');
      card.querySelector('.meta').innerHTML = `<span class="${done === total ? 'done' : 'open'}">${done}/${total}</span><br>${openAccess} draft access`;
      card.tabIndex = 0;
      card.addEventListener('click', () => { hireId = hire.id; route = 'hire'; render(); });
      list.append(card);
    });
    box.append(list);
  }
  box.append(addForm());
  return box;
}

function addForm() {
  const form = el(`<form class="card stack" style="margin-top:16px">
    <h3>New hire</h3>
    <label class="field">Name <input name="name" required maxlength="80" autocomplete="name"></label>
    <label class="field">Role <select name="role">${ROLES.map((r) => `<option>${r}</option>`).join('')}</select></label>
    <label class="field">Start date <input name="start" type="date"></label>
    <div class="actions"><button class="gold" type="submit">Add hire</button></div>
  </form>`);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const hire = {
      id: uid(),
      name: String(data.get('name') || '').trim(),
      role: String(data.get('role') || 'Helper'),
      start: String(data.get('start') || ''),
      tasks: {},
      access: {},
      notes: ''
    };
    if (!hire.name) return;
    state.hires.unshift(hire);
    save();
    hireId = hire.id;
    route = 'hire';
    render();
  });
  return form;
}

function viewHire() {
  const hire = state.hires.find((h) => h.id === hireId);
  const box = el('<section></section>');
  if (!hire) {
    box.append(el('<p class="empty">Hire not found.</p>'));
    return box;
  }
  const { done, total } = hireProgress(hire);
  box.append(el(`<p class="meta"><button type="button" class="ghost" data-back>← Crew</button></p>`));
  box.querySelector('[data-back]').addEventListener('click', () => { route = 'crew'; render(); });
  box.append(el(`<h2></h2>`));
  box.lastChild.textContent = hire.name;
  box.append(el(`<p class="help">${hire.role}${hire.start ? ' · ' + hire.start : ''} · ${done}/${total} first-week items</p>`));

  let day = null;
  TASKS.forEach((task) => {
    if (task.day !== day) {
      day = task.day;
      box.append(el(`<h3>${fmtDay(day)}</h3>`));
    }
    const row = el(`<label class="card task"><input type="checkbox"><div><h4></h4><p></p></div></label>`);
    row.querySelector('h4').textContent = task.title;
    row.querySelector('p').textContent = task.body;
    const boxEl = row.querySelector('input');
    boxEl.checked = !!hire.tasks[task.id];
    boxEl.addEventListener('change', () => {
      if (boxEl.checked) hire.tasks[task.id] = new Date().toISOString();
      else delete hire.tasks[task.id];
      save();
      render();
    });
    box.append(row);
  });

  box.append(el('<h3>Access drafts</h3>'));
  box.append(el('<p class="help">Drafts only. This app never creates an account, PIN, or mailbox. A human sends the request.</p>'));
  accessFor(hire.role).forEach((item) => {
    const status = hire.access[item.id] || 'draft';
    const card = el(`<article class="card"><span class="draft-tag"></span><h4></h4><div class="actions"></div></article>`);
    card.querySelector('.draft-tag').textContent = status === 'sent' ? 'MARKED SENT' : 'DRAFT — NOT CREATED';
    card.querySelector('h4').textContent = item.title;
    const send = el('<button type="button">Mark sent by a human</button>');
    const reset = el('<button type="button" class="ghost">Back to draft</button>');
    send.disabled = status === 'sent';
    send.addEventListener('click', () => { hire.access[item.id] = 'sent'; save(); render(); });
    reset.addEventListener('click', () => { hire.access[item.id] = 'draft'; save(); render(); });
    card.querySelector('.actions').append(send, reset);
    box.append(card);
  });

  const notes = el(`<label class="field" style="margin-top:18px">Manager notes<textarea></textarea></label>`);
  notes.querySelector('textarea').value = hire.notes || '';
  notes.querySelector('textarea').addEventListener('change', (e) => { hire.notes = e.target.value; save(); });
  box.append(notes);
  return box;
}

function viewDesk() {
  const box = el('<section></section>');
  box.append(el('<h2>Manager desk</h2>'));
  box.append(el('<p class="help">Incomplete first-week items and unsent access drafts. Generation is not authorized from this file. Accounts are never created here.</p>'));
  if (state.pinHash && !deskUnlocked) {
    const form = el(`<form class="card stack"><label class="field">Manager PIN<input class="pin" name="pin" inputmode="numeric" maxlength="8" autocomplete="off"></label><button class="gold" type="submit">Unlock desk</button></form>`);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = String(new FormData(form).get('pin') || '');
      deskUnlocked = (await sha(pin)) === state.pinHash;
      render();
    });
    box.append(form);
    return box;
  }
  if (!state.pinHash) {
    box.append(el('<p class="banner">Set a manager PIN in Shop before you hand this phone to crew.</p>'));
  }
  if (!state.hires.length) {
    box.append(el('<p class="empty">No hires yet. Add one on Crew.</p>'));
    return box;
  }
  state.hires.forEach((hire) => {
    const { tasks, access } = incomplete(hire);
    const card = el('<article class="card"></article>');
    card.append(el(`<h4></h4>`));
    card.firstChild.textContent = hire.name + ' · ' + hire.role;
    if (!tasks.length && !access.length) {
      card.append(el('<p class="done">First week complete. No open drafts.</p>'));
    } else {
      if (tasks.length) {
        const ul = el('<p class="open"></p>');
        ul.textContent = 'Still open: ' + tasks.map((t) => t.title).join(', ');
        card.append(ul);
      }
      if (access.length) {
        const ul = el('<p class="help"></p>');
        ul.textContent = 'Draft access: ' + access.map((t) => t.title).join(', ');
        card.append(ul);
      }
    }
    box.append(card);
  });
  const exp = el('<div class="actions"><button type="button">Export week summary</button></div>');
  exp.querySelector('button').addEventListener('click', exportWeek);
  box.append(exp);
  return box;
}

function viewSettings() {
  const box = el('<section></section>');
  box.append(el('<h2>Shop</h2>'));
  const form = el(`<form class="card stack">
    <label class="field">Shop name <input name="shop" maxlength="60"></label>
    <label class="field">Tagline <input name="tag" maxlength="80"></label>
    <div class="actions"><button class="gold" type="submit">Save shop</button></div>
  </form>`);
  form.shop.value = state.shop;
  form.tag.value = state.tag;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    state.shop = form.shop.value.trim() || 'Crew Start';
    state.tag = form.tag.value.trim();
    save();
    render();
  });
  box.append(form);

  const pin = el(`<form class="card stack" style="margin-top:12px">
    <h3>Manager PIN</h3>
    <p class="help">Four or more digits. Stored as a hash in this browser only. No PIN lives in the repo. Cosmic Gold is not a client option in this kit.</p>
    <label class="field">New PIN <input class="pin" name="pin" inputmode="numeric" maxlength="8" autocomplete="new-password"></label>
    <div class="actions"><button type="submit">Set PIN</button></div>
  </form>`);
  pin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = String(new FormData(pin).get('pin') || '');
    if (value.length < 4) return;
    state.pinHash = await sha(value);
    deskUnlocked = false;
    save();
    render();
  });
  box.append(pin);
  return box;
}

function exportWeek() {
  const lines = ['# Crew Start week', '', `Shop: ${state.shop}`, `Exported: ${new Date().toISOString()}`, ''];
  state.hires.forEach((hire) => {
    const { tasks, access } = incomplete(hire);
    const { done, total } = hireProgress(hire);
    lines.push(`## ${hire.name} (${hire.role})`);
    lines.push(`Progress: ${done}/${total}`);
    lines.push(tasks.length ? 'Still open: ' + tasks.map((t) => t.title).join(', ') : 'First week complete.');
    lines.push(access.length ? 'Draft access: ' + access.map((t) => t.title).join(', ') : 'No open drafts.');
    lines.push('');
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'crew-start-week.md';
  a.click();
}

document.querySelectorAll('.tabs button').forEach((btn) => {
  btn.addEventListener('click', () => { route = btn.dataset.route; render(); });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

render();
