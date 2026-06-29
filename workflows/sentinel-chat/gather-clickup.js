// Live boards + story points + on-demand REFERENCED board (by URL/id or name).
const CK = '__CLICKUP_API_KEY__';
const J = (r) => typeof r === 'string' ? JSON.parse(r) : r;
const http = (url) => this.helpers.httpRequest({ method:'GET', url, headers:{ Authorization: CK } });
const now = Date.now();
const orgs = [
  { key:'FreshSens', sprintFolder:'90090412752' },
  { key:'GOHM',      sprintFolder:'90151692710' },
  { key:'DIEFI',     sprintFolder:'90145177889' },
];
// Named boards Cem may reference without a URL -> space id, built from the workspace registry
// (Load Registry node) so every space's routing_keywords are honored — not a hardcoded few.
let REG = [];
try { REG = ($('Load Registry').first().json.workspaces) || []; } catch (e) {}
let NAMED = REG.filter(r => r.kind === 'clickup_space')
  .map(r => ({ keys: ((r.config && r.config.routing_keywords) || []).map(k => k.toLowerCase()), space: r.id, name: r.name, org: r.org }))
  .filter(n => n.keys.length);
if (!NAMED.length) {   // fallback if the registry didn't load
  NAMED = [
    { keys:['team lead','team leads','takım lider','ekip lider','team-lead'], space:'90155478263' },
    { keys:['management','yönetim'], space:'90010053606' },
    { keys:['sales','marketing','ph & ops','ph&ops','operations'], space:'90152680846' },
    { keys:['fundraising','yatırım','fon raise'], space:'90159399897' },
  ];
}
const loadTasks = async (lid) => {
  let tasks = []; let page = 0;
  while (page < 12) {
    const d = J(await http(`https://api.clickup.com/api/v2/list/${lid}/task?archived=false&include_closed=true&subtasks=false&page=${page}`));
    const t = d.tasks || []; tasks = tasks.concat(t);
    if (d.last_page || !t.length) break; page++;
  }
  return tasks;
};
const rollupSP = (tasks) => {
  const sp = {};
  for (const t of tasks) {
    const p = Number(t.points) || 0;
    const st = ((t.status||{}).status||'').toLowerCase();
    const done = st === 'closed' || st === 'review';
    for (const a of (t.assignees||[])) {
      const u = a.username; sp[u] = sp[u] || { doneSP:0, doneN:0, remSP:0, remN:0 };
      if (done) { sp[u].doneSP += p; sp[u].doneN++; } else { sp[u].remSP += p; sp[u].remN++; }
    }
  }
  return sp;
};
const countByStatus = (tasks) => {
  const totals = {}; const people = {}; const stOrder = {};
  for (const t of tasks) {
    const so = t.status||{}; const st = so.status||'?';
    if (!(st in stOrder)) stOrder[st] = so.orderindex!=null ? Number(so.orderindex) : 99;
    totals[st] = (totals[st]||0)+1;
    const asg = t.assignees||[];
    if (!asg.length) { people['(unassigned)'] = people['(unassigned)']||{}; people['(unassigned)'][st]=(people['(unassigned)'][st]||0)+1; }
    for (const a of asg) { people[a.username] = people[a.username]||{}; people[a.username][st]=(people[a.username][st]||0)+1; }
  }
  const order = Object.keys(totals).sort((a,b)=>(stOrder[a]-stOrder[b])||a.localeCompare(b));
  return { order, totals, people };
};

const taskIndex = [];
const pushIndex = (tasks, label) => { for (const t of tasks) { if (taskIndex.length<140) taskIndex.push({ id:t.id, name:(t.name||'').substring(0,50), org:label }); } };

// ---- 1) active-sprint boards per org ----
const boards = [];
for (const o of orgs) {
  try {
    const lists = (J(await http(`https://api.clickup.com/api/v2/folder/${o.sprintFolder}/list?archived=false`)).lists)||[];
    let sprint = lists.find(l => l.start_date && l.due_date && Number(l.start_date)<=now && now<=Number(l.due_date));
    const active = !!sprint;
    if (!sprint) { const fut = lists.filter(l=>l.start_date).sort((a,b)=>Number(b.start_date)-Number(a.start_date)); sprint = fut[0]; }
    if (!sprint) { boards.push({ org:o.key, error:'no sprint list' }); continue; }
    const tasks = await loadTasks(sprint.id);
    pushIndex(tasks, o.key);
    const c = countByStatus(tasks);
    boards.push({ org:o.key, sprint:sprint.name, active, total:tasks.length, order:c.order, totals:c.totals, people:c.people, sp:rollupSP(tasks) });
  } catch (e) { boards.push({ org:o.key, error:e.message }); }
}

// ---- 2) referenced board(s) from the message / recent conversation ----
const wh = $('Chat In').first().json;
const msg = (wh.body && wh.body.text) || (wh.query && wh.query.text) || '';
let conv = ''; try { conv = $('Gather Conversation').first().json.transcript || ''; } catch (e) {}
const hay = (msg + '  ' + msg + '  ' + conv).toLowerCase();   // weight the live message
const refBoards = []; const seenLists = new Set(boards.map(()=>null));
const tryAddList = async (lid, hintName) => {
  if (!lid || seenLists.has(String(lid))) return;
  try {
    const li = J(await http(`https://api.clickup.com/api/v2/list/${lid}`));
    if (!li || !li.id) return;
    seenLists.add(String(li.id));
    const tasks = await loadTasks(li.id);
    pushIndex(tasks, hintName || li.name);
    const c = countByStatus(tasks);
    refBoards.push({ name:`${li.name}`, listId:li.id, total:tasks.length, order:c.order, totals:c.totals, people:c.people, sp:rollupSP(tasks),
      tasks: tasks.map(t=>({ id:t.id, name:(t.name||'').substring(0,60), assignee:(t.assignees||[]).map(a=>a.username), status:(t.status||{}).status||'?', points:(t.points==null?null:Number(t.points)) })) });
  } catch (e) {}
};
// 2a) explicit numeric ids in the message (covers pasted ClickUp URLs); validate each as a real list
const ids = Array.from(new Set((hay.match(/\d{8,13}/g)||[]))).slice(0, 8);
for (const id of ids) { if (refBoards.length >= 2) break; await tryAddList(id); }
// 2b) named boards (only if nothing explicit matched, or to add the named one)
// Word-boundary match so short keywords ("ml","ota","api") don't substring-hit ordinary
// words in the message/conversation (html, total, capital) and pull in the wrong board.
const kwHit = (k) => {
  const kk = String(k).toLowerCase().trim();
  if (!kk) return false;
  const re = new RegExp('(^|[^a-z0-9])' + kk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)');
  return re.test(hay);
};
for (const nb of NAMED) {
  if (refBoards.length >= 2) break;
  if (!nb.keys.some(kwHit)) continue;
  try {
    let lists = (J(await http(`https://api.clickup.com/api/v2/space/${nb.space}/list?archived=false`)).lists)||[];
    const folders = (J(await http(`https://api.clickup.com/api/v2/space/${nb.space}/folder?archived=false`)).folders)||[];
    for (const f of folders) lists = lists.concat(f.lists||[]);
    let cur = lists.find(l => l.start_date && l.due_date && Number(l.start_date)<=now && now<=Number(l.due_date));
    if (!cur) { const fut = lists.filter(l=>l.start_date).sort((a,b)=>Number(b.start_date)-Number(a.start_date)); cur = fut[0]; }
    if (cur && !seenLists.has(String(cur.id))) await tryAddList(cur.id);
  } catch (e) {}
}

return [{ json: { boards, refBoards, taskIndex } }];
