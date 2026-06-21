// ===== Sentinel · Comprehensive Data Collector =====
// Pulls from: FS+GOHM Gmail, FS+GOHM Calendar, Slack (6 channels), ClickUp (3 orgs)
// Each source isolated in try/catch so one failure never kills the briefing.

const dates = $('Set Date Range').first().json;
const out = { todayDate: dates.todayDate, yesterdayDate: dates.yesterdayDate, errors: [] };

// --- Credentials ---
const FS = { id: '836787456970-1rrue4ph9lhv0gesi8mq2i0auhppbkev.apps.googleusercontent.com', secret: '__GOOGLE_CLIENT_SECRET__' };
const GOHM = { id: '623417040507-4pe98u0bsd3tdrdgiclch6ad0ioprkbr.apps.googleusercontent.com', secret: '__GOOGLE_CLIENT_SECRET__' };
const RT = {
  fsGmail: '__GOOGLE_REFRESH_TOKEN__',
  fsCal:   '__GOOGLE_REFRESH_TOKEN__',
  fsDrive: '__GOOGLE_REFRESH_TOKEN__',
  gohmGmail: '__GOOGLE_REFRESH_TOKEN__',
  gohmCal: '__GOOGLE_REFRESH_TOKEN__',
  gohmDrive: '__GOOGLE_REFRESH_TOKEN__',
};
const SLACK_TOKEN = '__SLACK_BOT_TOKEN__';
const CLICKUP_KEY = '__CLICKUP_API_KEY__';
const CEM_CU_ID = 54229113;

const CLICKUP_TEAMS = [
  { id: '9009068877', name: 'FreshSens' },
  { id: '42085420', name: 'GOHM' },
  { id: '9014647941', name: 'DIEFI' },
];

const googleToken = async (cid, secret, rt) => {
  const resp = await this.helpers.httpRequest({
    method: 'POST',
    url: 'https://oauth2.googleapis.com/token',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${cid}&client_secret=${secret}&refresh_token=${encodeURIComponent(rt)}&grant_type=refresh_token`,
  });
  const d = typeof resp === 'string' ? JSON.parse(resp) : resp;
  return d.access_token;
};

const header = (msg, name) => {
  const h = (msg.payload?.headers || []).find(x => x.name === name);
  return h ? h.value : '';
};

// ===== EMAIL (both accounts) =====
const fetchEmails = async (cid, secret, rt, label) => {
  const token = await googleToken(cid, secret, rt);
  // Scan the recent inbox (new + recent backlog) so triage has real material to clean.
  const q = encodeURIComponent('in:inbox');
  const list = await this.helpers.httpRequest({
    method: 'GET',
    url: `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=${q}`,
    headers: { Authorization: `Bearer ${token}` },
  });
  const listData = typeof list === 'string' ? JSON.parse(list) : list;
  const ids = (listData.messages || []).map(m => m.id);
  const msgs = await Promise.all(ids.map(id => this.helpers.httpRequest({
    method: 'GET',
    url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata`
      + `&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date&metadataHeaders=List-Unsubscribe`,
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => typeof r === 'string' ? JSON.parse(r) : r).catch(() => null)));
  const catOf = (labels) => {
    if (labels.includes('CATEGORY_PROMOTIONS')) return 'promotions';
    if (labels.includes('CATEGORY_SOCIAL')) return 'social';
    if (labels.includes('CATEGORY_UPDATES')) return 'updates';
    if (labels.includes('CATEGORY_FORUMS')) return 'forums';
    return 'primary';
  };
  return msgs.filter(Boolean).map(m => {
    const labels = m.labelIds || [];
    const from = header(m, 'From');
    return {
      id: m.id,
      from,
      subject: header(m, 'Subject') || '(no subject)',
      snippet: (m.snippet || '').substring(0, 220),
      unread: labels.includes('UNREAD'),
      important: labels.includes('IMPORTANT'),
      starred: labels.includes('STARRED'),
      category: catOf(labels),
      bulk: !!header(m, 'List-Unsubscribe'),                       // newsletter / bulk sender
      automated: /no-?reply|noreply|notifications?@|mailer-daemon|donotreply|do-not-reply|@.*\.(atlassian|github|gitlab)\b/i.test(from),
    };
  });
};

try { out.emailsFs = await fetchEmails(FS.id, FS.secret, RT.fsGmail, 'FS'); }
catch (e) { out.emailsFs = []; out.errors.push('FS Gmail: ' + e.message); }

try { out.emailsGohm = await fetchEmails(GOHM.id, GOHM.secret, RT.gohmGmail, 'GOHM'); }
catch (e) { out.emailsGohm = []; out.errors.push('GOHM Gmail: ' + e.message); }

// ===== CALENDAR (both accounts) =====
const fetchEvents = async (cid, secret, rt, calId) => {
  const token = await googleToken(cid, secret, rt);
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`
    + `?timeMin=${encodeURIComponent(dates.yesterdayStart)}&timeMax=${encodeURIComponent(dates.todayEnd)}`
    + `&singleEvents=true&orderBy=startTime&maxResults=40`;
  const resp = await this.helpers.httpRequest({ method: 'GET', url, headers: { Authorization: `Bearer ${token}` } });
  const d = typeof resp === 'string' ? JSON.parse(resp) : resp;
  return (d.items || []).map(e => ({
    summary: e.summary || '(no title)',
    start: e.start?.dateTime || e.start?.date || '',
    end: e.end?.dateTime || e.end?.date || '',
    location: e.location || '',
    attendees: (e.attendees || []).map(a => a.email).filter(x => x).slice(0, 8).join(', '),
    status: e.status,
  })).filter(e => e.summary !== '(no title)' && e.status !== 'cancelled');
};

try { out.calFs = await fetchEvents(FS.id, FS.secret, RT.fsCal, 'ca@freshsens.ai'); }
catch (e) { out.calFs = []; out.errors.push('FS Calendar: ' + e.message); }

try { out.calGohm = await fetchEvents(GOHM.id, GOHM.secret, RT.gohmCal, 'cem.ayyildiz@gohm.tech'); }
catch (e) { out.calGohm = []; out.errors.push('GOHM Calendar: ' + e.message); }

// ===== MEETING NOTES (Gemini summaries from Drive — both accounts, since yesterday) =====
const fetchMeetingNotes = async (cid, secret, rt) => {
  const token = await googleToken(cid, secret, rt);
  const q = encodeURIComponent(
    `(name contains 'Notes by Gemini' or name contains 'Transcript') `
    + `and mimeType='application/vnd.google-apps.document' `
    + `and modifiedTime > '${dates.yesterdayStart}' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&pageSize=10&fields=files(id,name,modifiedTime)`;
  const resp = await this.helpers.httpRequest({ method: 'GET', url, headers: { Authorization: `Bearer ${token}` } });
  const d = typeof resp === 'string' ? JSON.parse(resp) : resp;
  const notes = [];
  for (const f of (d.files || []).slice(0, 6)) {
    try {
      const raw = await this.helpers.httpRequest({
        method: 'GET',
        url: `https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=text/plain`,
        headers: { Authorization: `Bearer ${token}` },
        json: false,
      });
      const text = typeof raw === 'string' ? raw : String(raw);
      const idx = text.indexOf('Summary');
      const body = (idx >= 0 ? text.slice(idx) : text).replace(/\n{2,}/g, '\n').trim().substring(0, 2000);
      notes.push({ id: f.id, title: f.name.replace(/ - Notes by Gemini$/, '').replace(/ - Transcript$/, ''), summary: body });
    } catch (e) { /* skip unreadable doc */ }
  }
  return notes;
};

try {
  const fsN = await fetchMeetingNotes(FS.id, FS.secret, RT.fsDrive).catch(() => []);
  const gohmN = await fetchMeetingNotes(GOHM.id, GOHM.secret, RT.gohmDrive).catch(() => []);
  const seen = new Set();
  out.meetingNotes = [];
  for (const n of [...fsN, ...gohmN]) {
    if (seen.has(n.title)) continue;
    seen.add(n.title);
    out.meetingNotes.push(n);
  }
} catch (e) { out.meetingNotes = []; out.errors.push('Meeting notes: ' + e.message); }

// ===== SLACK (auto-discover every channel the bot is in — public + private) =====
// No hardcoded list: invite @sentinel to any channel and it appears next run.
const oldest = Math.floor((Date.now() - 28 * 3600 * 1000) / 1000);
try {
  let channels = [];
  let cursor = '';
  do {
    const url = `https://slack.com/api/users.conversations?types=public_channel,private_channel`
      + `&exclude_archived=true&limit=200${cursor ? '&cursor=' + cursor : ''}`;
    const resp = await this.helpers.httpRequest({ method: 'GET', url, headers: { Authorization: `Bearer ${SLACK_TOKEN}` } });
    const d = typeof resp === 'string' ? JSON.parse(resp) : resp;
    channels = channels.concat((d.channels || []).map(c => ({ id: c.id, name: c.name, priv: c.is_private })));
    cursor = (d.response_metadata || {}).next_cursor || '';
  } while (cursor);

  out.slack = [];
  for (const ch of channels) {
    try {
      const resp = await this.helpers.httpRequest({
        method: 'GET',
        url: `https://slack.com/api/conversations.history?channel=${ch.id}&oldest=${oldest}&limit=40`,
        headers: { Authorization: `Bearer ${SLACK_TOKEN}` },
      });
      const d = typeof resp === 'string' ? JSON.parse(resp) : resp;
      const msgs = (d.messages || [])
        .filter(m => m.type === 'message' && (m.text || '').trim())
        .map(m => (m.text || '').replace(/\s+/g, ' ').substring(0, 240))
        .slice(0, 15);
      out.slack.push({ channel: ch.name, priv: ch.priv, count: msgs.length, messages: msgs });
    } catch (e) {
      out.slack.push({ channel: ch.name, count: 0, messages: [], error: e.message });
    }
  }
  out.slackChannelCount = channels.length;
} catch (e) { out.slack = []; out.errors.push('Slack: ' + e.message); }

// ===== CLICKUP (3 orgs): team activity per project + Cem's overdue =====
const fmtDue = (ms) => ms ? new Date(parseInt(ms)).toLocaleDateString('en-GB') : 'no due';
const CK = { Authorization: CLICKUP_KEY };
const activityCutoff = Date.now() - 48 * 3600 * 1000;
out.clickupActivity = [];
out.clickupOverdue = [];

for (const team of CLICKUP_TEAMS) {
  // space id -> name map (live, so renamed/new projects are picked up)
  const spaceMap = {};
  try {
    const sp = await this.helpers.httpRequest({ method: 'GET', url: `https://api.clickup.com/api/v2/team/${team.id}/space?archived=false`, headers: CK });
    const spd = typeof sp === 'string' ? JSON.parse(sp) : sp;
    (spd.spaces || []).forEach(s => { spaceMap[s.id] = s.name; });
  } catch (e) { out.errors.push(`ClickUp spaces ${team.name}: ${e.message}`); }

  // --- Team activity: everything that moved in last 48h, grouped by project (space) ---
  try {
    const url = `https://api.clickup.com/api/v2/team/${team.id}/task`
      + `?date_updated_gt=${activityCutoff}&order_by=updated&subtasks=true&include_closed=true&page=0`;
    const resp = await this.helpers.httpRequest({ method: 'GET', url, headers: CK });
    const d = typeof resp === 'string' ? JSON.parse(resp) : resp;
    const tasks = d.tasks || [];
    const bySpace = {};
    for (const t of tasks) {
      const sname = spaceMap[(t.space || {}).id] || (t.folder || {}).name || (t.list || {}).name || 'Other';
      if (!bySpace[sname]) bySpace[sname] = { active: 0, completed: 0, people: {}, tasks: [] };
      const stype = (t.status || {}).type;
      const done = stype === 'closed' || stype === 'done';
      if (done) bySpace[sname].completed++; else bySpace[sname].active++;
      (t.assignees || []).forEach(a => { bySpace[sname].people[a.username] = (bySpace[sname].people[a.username] || 0) + 1; });
      bySpace[sname].tasks.push({
        name: t.name,
        status: (t.status || {}).status || '?',
        done,
        assignee: (t.assignees || []).map(a => a.username).join(', ') || 'unassigned',
        list: (t.list || {}).name || '',
      });
    }
    const spaces = Object.entries(bySpace).map(([space, v]) => {
      const active = v.tasks.filter(t => !t.done).slice(0, 6);
      const completed = v.tasks.filter(t => t.done).slice(0, 4);
      return {
        space, active: v.active, completed: v.completed,
        topPeople: Object.entries(v.people).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, c]) => `${n} (${c})`),
        tasks: [...active, ...completed],
      };
    }).sort((a, b) => (b.active + b.completed) - (a.active + a.completed));
    // Flat task list (name + who + status) so the AI can bucket FreshSens work into the
    // functional teams (backend/frontend/ML/firmware/hardware/postharvest/ops/sales).
    const allTasks = tasks.slice(0, 50).map(t => ({
      name: t.name,
      status: (t.status || {}).status || '?',
      done: ((t.status || {}).type === 'closed' || (t.status || {}).type === 'done'),
      assignee: (t.assignees || []).map(a => a.username).join(', ') || 'unassigned',
      space: spaceMap[(t.space || {}).id] || (t.list || {}).name || '',
    }));
    out.clickupActivity.push({ org: team.name, totalUpdated: tasks.length, spaces, allTasks });
  } catch (e) {
    out.clickupActivity.push({ org: team.name, totalUpdated: 0, spaces: [], error: e.message });
  }

  // --- Cem's personal overdue (accountability) ---
  try {
    const url = `https://api.clickup.com/api/v2/team/${team.id}/task`
      + `?overdue=true&include_closed=false&subtasks=true&order_by=due_date&assignees%5B%5D=${CEM_CU_ID}`;
    const resp = await this.helpers.httpRequest({ method: 'GET', url, headers: CK });
    const d = typeof resp === 'string' ? JSON.parse(resp) : resp;
    const tasks = (d.tasks || []).map(t => ({
      name: t.name, status: (t.status || {}).status || '?', due: fmtDue(t.due_date),
      priority: (t.priority || {}).priority || 'none',
      space: spaceMap[(t.space || {}).id] || (t.list || {}).name || '',
    }));
    out.clickupOverdue.push({ org: team.name, count: tasks.length, tasks: tasks.slice(0, 12) });
  } catch (e) {
    out.clickupOverdue.push({ org: team.name, count: 0, tasks: [], error: e.message });
  }
}

// ===== PERSONAL — GOHM ClickUp "Home" space (Loxone smart-home + house items) =====
try {
  const url = `https://api.clickup.com/api/v2/team/42085420/task`
    + `?space_ids%5B%5D=90151309240&include_closed=false&subtasks=true&order_by=updated`;
  const resp = await this.helpers.httpRequest({ method: 'GET', url, headers: CK });
  const d = typeof resp === 'string' ? JSON.parse(resp) : resp;
  out.personal = (d.tasks || []).slice(0, 20).map(t => ({
    name: t.name,
    status: (t.status || {}).status || '?',
    assignee: (t.assignees || []).map(a => a.username).join(', ') || 'unassigned',
    due: t.due_date ? new Date(parseInt(t.due_date)).toLocaleDateString('en-GB') : '',
  }));
} catch (e) { out.personal = []; out.errors.push('Personal: ' + e.message); }

return [{ json: out }];
