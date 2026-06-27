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

// ===== CLICKUP (registry-driven: per-space cadence + depth; weekly spaces folded only on Friday) =====
// Source of truth = the `workspaces` table (Load Registry node), with an embedded fallback so a
// registry read failure never kills the briefing. Each space's cadence/depth decides the treatment:
//   deep    → full active-sprint board (Review counts as done) + board-hygiene flags
//   track   → recently-moved tasks in the space, grouped by status/assignee
//   summary → open task list (Home / weekly headline)
// weekly-fri spaces only get a full summary on Fridays, but are ALWAYS scanned for critical items
// (urgent/high priority · overdue · blocker keyword · Cem assigned) which escalate into the daily.
const dr = $('Set Date Range').first().json;
const isFriday = !!dr.isFriday, isMonday = !!dr.isMonday;
const CK = { Authorization: CLICKUP_KEY };
const fmtDue = (ms) => ms ? new Date(parseInt(ms)).toLocaleDateString('en-GB') : 'no due';
const J = (r) => typeof r === 'string' ? JSON.parse(r) : r;
const http = (url) => this.helpers.httpRequest({ method: 'GET', url, headers: CK });
const now = Date.now();
const activityCutoff = now - 7 * 24 * 3600 * 1000;        // "recently moved" = last 7d
const STALE_MS = 3 * 24 * 3600 * 1000;
const BLOCKER_RE = /blocked|blocker|escalat|risk|delay|stuck/i;
const ORG_TEAM   = { freshsens: '9009068877', gohm: '42085420', diefi: '9014647941' };
const ORG_SPRINT = { freshsens: '90090412752', gohm: '90151692710', diefi: '90145177889' };
const HOME_SPACE = '90151309240';

// Registry (DB), with embedded fallback mirroring infra/workspaces.json.
let registry = [];
try { registry = ($('Load Registry').first().json.workspaces) || []; } catch (e) {}
if (!registry.length) {
  registry = [
    { id:'90090136601', org:'freshsens', name:'Development', cadence:'daily', depth:'deep', config:{ has_sprint:true } },
    { id:'90010053606', org:'freshsens', name:'Management', cadence:'daily', depth:'track', config:{} },
    { id:'90152680846', org:'freshsens', name:'Sales / Marketing / PH & Ops', cadence:'weekly-fri', depth:'summary', config:{} },
    { id:'90155478263', org:'freshsens', name:'Team Leads', cadence:'weekly-fri', depth:'summary', config:{} },
    { id:'90159399897', org:'freshsens', name:'Fundraising', cadence:'weekly-fri', depth:'summary', config:{} },
    { id:'901511184184', org:'freshsens', name:'Admin', cadence:'mute', depth:'none', config:{} },
    { id:'90090428426', org:'gohm', name:'Management', cadence:'daily', depth:'track', config:{ has_sprint:true } },
    { id:'90143023495', org:'diefi', name:'Development', cadence:'daily', depth:'track', config:{ has_sprint:true } },
    { id:HOME_SPACE, org:'gohm', name:'Home', cadence:'daily', depth:'summary', config:{} },
  ];
  out.errors.push('ClickUp: registry not loaded from DB — used embedded fallback');
}
const cuSpaces = registry.filter(r => r.kind === 'clickup_space' || (!r.kind && r.id));

const isDone = (t) => { const s = (t.status||{}); const st = (s.status||'').toLowerCase(); return st==='review' || s.type==='closed' || s.type==='done'; };
const taskLite = (t) => ({ id:t.id, url:t.url||null, name:(t.name||'').substring(0,80),
  status:(t.status||{}).status||'?', done:isDone(t), points:(t.points==null?null:Number(t.points)),
  assignee:(t.assignees||[]).map(a=>a.username).join(', ')||'unassigned',
  updated:t.date_updated?Number(t.date_updated):null, due:t.due_date?Number(t.due_date):null,
  priority:(t.priority||{}).priority||'none' });

// space task fetch (one call, recently-updated + open)
const spaceTasks = async (org, spaceId, { openClosed = true } = {}) => {
  const team = ORG_TEAM[org];
  const url = `https://api.clickup.com/api/v2/team/${team}/task`
    + `?space_ids%5B%5D=${spaceId}&date_updated_gt=${activityCutoff}&order_by=updated`
    + `&subtasks=true&include_closed=${openClosed}&page=0`;
  return (J(await http(url)).tasks) || [];
};
// active-sprint board for the org (full, paginated, Review=done) — deep depth
const sprintBoard = async (org) => {
  const folder = ORG_SPRINT[org];
  const lists = (J(await http(`https://api.clickup.com/api/v2/folder/${folder}/list?archived=false`)).lists) || [];
  let sprint = lists.find(l => l.start_date && l.due_date && Number(l.start_date)<=now && now<=Number(l.due_date));
  const active = !!sprint;
  if (!sprint) { const fut = lists.filter(l=>l.start_date).sort((a,b)=>Number(b.start_date)-Number(a.start_date)); sprint = fut[0]; }
  if (!sprint) return null;
  let tasks = [], page = 0;
  while (page < 8) {
    const d = J(await http(`https://api.clickup.com/api/v2/list/${sprint.id}/task?archived=false&include_closed=true&subtasks=false&page=${page}`));
    const t = d.tasks || []; tasks = tasks.concat(t);
    if (d.last_page || !t.length) break; page++;
  }
  return { sprint: sprint.name, active, tasks };
};
const groupByStatusPeople = (tasks) => {
  const totals = {}, people = {}, sp = {};
  for (const t of tasks) {
    const st = (t.status||{}).status||'?'; totals[st]=(totals[st]||0)+1;
    const done = isDone(t), p = Number(t.points)||0;
    const asg = (t.assignees||[]); const names = asg.length ? asg.map(a=>a.username) : ['(unassigned)'];
    for (const u of names) { people[u]=people[u]||{done:0,active:0,doneSP:0,remSP:0}; if (done){people[u].done++;people[u].doneSP+=p;} else {people[u].active++;people[u].remSP+=p;} }
  }
  return { totals, people };
};
// escalation scan: critical items in a weekly/mute space (any day)
const escalate = (org, spaceName, tasks) => {
  const hits = [];
  for (const t of tasks) {
    if (isDone(t)) continue;
    const pr = ((t.priority||{}).priority||'').toLowerCase();
    const overdue = t.due_date && Number(t.due_date) < now;
    const blocker = BLOCKER_RE.test(t.name||'');
    const mine = (t.assignees||[]).some(a => Number(a.id) === CEM_CU_ID);
    const why = [pr==='urgent'||pr==='high'?pr:null, overdue?'overdue':null, blocker?'blocker':null, mine?'you':null].filter(Boolean);
    if (why.length) hits.push({ org, space:spaceName, name:(t.name||'').substring(0,80), status:(t.status||{}).status||'?',
      assignee:(t.assignees||[]).map(a=>a.username).join(', ')||'unassigned', why: why.join('+'), url:t.url||null,
      due: t.due_date?fmtDue(t.due_date):null, priority: pr||'none' });
  }
  return hits.slice(0, 6);
};

out.clickup = { isFriday, weekdayName: dr.weekdayName, daily: [], weekly: [], escalations: [], personal: [] };
out.personal = [];

for (const s of cuSpaces) {
  const org = s.org, depth = s.depth, cadence = s.cadence, cfg = s.config || {};
  const label = `${org}/${s.name}`;
  try {
    // Home → personal view
    if (s.id === HOME_SPACE) {
      const tasks = await spaceTasks(org, s.id, { openClosed:false });
      out.personal = tasks.slice(0, 20).map(taskLite);
      out.clickup.personal = out.personal;
      continue;
    }

    if (depth === 'deep' && cfg.has_sprint) {
      const b = await sprintBoard(org);
      if (b) {
        const g = groupByStatusPeople(b.tasks);
        const activeTasks = b.tasks.filter(t => !isDone(t));
        const hygiene = [];
        const stale = activeTasks.filter(t => t.date_updated && (now - Number(t.date_updated)) > STALE_MS && /progress|doing|wip/i.test((t.status||{}).status||''));
        if (stale.length) hygiene.push({ flag:'stale_in_progress', n:stale.length, sample: stale.slice(0,4).map(t=>(t.name||'').substring(0,50)) });
        const noPts = activeTasks.filter(t => t.points==null);
        if (noPts.length) hygiene.push({ flag:'missing_points', n:noPts.length, of:activeTasks.length });
        if (!b.tasks.some(t => ((t.status||{}).status||'').toLowerCase()==='review')) hygiene.push({ flag:'nothing_in_review' });
        out.clickup.daily.push({ org, name:s.name, depth, sprint:b.sprint, active:b.active,
          total:b.tasks.length, statusTotals:g.totals, people:g.people, hygiene,
          tasks: b.tasks.map(taskLite).slice(0, 60) });
      } else { out.clickup.daily.push({ org, name:s.name, depth, error:'no sprint list' }); }
    } else if (cadence === 'daily' || (cadence==='weekly-fri' && isFriday) || (cadence==='weekly-mon' && isMonday)) {
      // track / summary: recent movement in the space
      const tasks = await spaceTasks(org, s.id, { openClosed:true });
      const g = groupByStatusPeople(tasks);
      const done = tasks.filter(isDone), active = tasks.filter(t=>!isDone(t));
      const entry = { org, name:s.name, depth, cadence, movedLast7d:tasks.length,
        active:active.length, completed:done.length, statusTotals:g.totals, people:g.people,
        doneSP: Object.values(g.people).reduce((a,p)=>a+(p.doneSP||0),0),
        tasks: [...active.slice(0,8), ...done.slice(0,5)].map(taskLite) };
      if (cadence === 'daily') out.clickup.daily.push(entry); else out.clickup.weekly.push(entry);
    }

    // escalation scan for non-daily spaces (always, every day)
    if (cadence !== 'daily') {
      const tasks = await spaceTasks(org, s.id, { openClosed:false });
      out.clickup.escalations.push(...escalate(org, s.name, tasks));
    }
  } catch (e) { out.errors.push(`ClickUp ${label}: ${e.message}`); }
}

// --- Cem's overdue per org (accountability) — kept in the legacy shape for Emit Signals ---
out.clickupOverdue = [];
for (const [org, name] of [['freshsens','FreshSens'],['gohm','GOHM'],['diefi','DIEFI']]) {
  try {
    const url = `https://api.clickup.com/api/v2/team/${ORG_TEAM[org]}/task`
      + `?overdue=true&include_closed=false&subtasks=true&order_by=due_date&assignees%5B%5D=${CEM_CU_ID}`;
    const d = J(await http(url));
    const tasks = (d.tasks || []).map(t => ({ id:t.id, url:t.url||null, name:t.name,
      status:(t.status||{}).status||'?', due:fmtDue(t.due_date),
      priority:(t.priority||{}).priority||'none', space:(t.space||{}).id || (t.list||{}).name || '' }));
    out.clickupOverdue.push({ org: name, count: tasks.length, tasks: tasks.slice(0, 12) });
  } catch (e) { out.clickupOverdue.push({ org: name, count: 0, tasks: [], error: e.message }); }
}

return [{ json: out }];
