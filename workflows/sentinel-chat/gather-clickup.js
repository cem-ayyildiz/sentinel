// Live "Development board" = each org's active sprint list, counted by REAL status + person.
// Full pagination + include_closed so totals match the ClickUp board exactly (no 7d/page-0 cap).
const CK = '__CLICKUP_API_KEY__';
const orgs = [
  { key:'FreshSens', sprintFolder:'90090412752' },
  { key:'GOHM',      sprintFolder:'90151692710' },
  { key:'DIEFI',     sprintFolder:'90145177889' },
];
const J = (r) => typeof r === 'string' ? JSON.parse(r) : r;
const http = (url) => this.helpers.httpRequest({ method:'GET', url, headers:{ Authorization: CK } });
const now = Date.now();
const boards = []; const taskIndex = [];
for (const o of orgs) {
  try {
    const lr = J(await http(`https://api.clickup.com/api/v2/folder/${o.sprintFolder}/list?archived=false`));
    const lists = lr.lists || [];
    let sprint = lists.find(l => l.start_date && l.due_date && Number(l.start_date) <= now && now <= Number(l.due_date));
    const active = !!sprint;
    if (!sprint) { const fut = lists.filter(l=>l.start_date).sort((a,b)=>Number(b.start_date)-Number(a.start_date)); sprint = fut[0]; }
    if (!sprint) { boards.push({ org:o.key, error:'no sprint list' }); continue; }
    let tasks = []; let page = 0;
    while (page < 15) {
      const d = J(await http(`https://api.clickup.com/api/v2/list/${sprint.id}/task?archived=false&include_closed=true&subtasks=false&page=${page}`));
      const t = d.tasks || []; tasks = tasks.concat(t);
      if (d.last_page || !t.length) break; page++;
    }
    const totals = {}; const people = {}; const stOrder = {};
    for (const t of tasks) {
      const so = t.status || {}; const st = so.status || '?';
      if (!(st in stOrder)) stOrder[st] = (so.orderindex != null ? Number(so.orderindex) : 99);
      totals[st] = (totals[st] || 0) + 1;
      if (taskIndex.length < 90) taskIndex.push({ id:t.id, name:(t.name||'').substring(0,50), org:o.key });
      const asg = t.assignees || [];
      if (!asg.length) { people['(unassigned)'] = people['(unassigned)'] || {}; people['(unassigned)'][st] = (people['(unassigned)'][st]||0)+1; }
      for (const a of asg) { const u = a.username; people[u] = people[u] || {}; people[u][st] = (people[u][st]||0)+1; }
    }
    const order = Object.keys(totals).sort((a,b)=>(stOrder[a]-stOrder[b]) || a.localeCompare(b));
    boards.push({ org:o.key, sprint:sprint.name, active, total:tasks.length, order, totals, people });
  } catch (e) { boards.push({ org:o.key, error:e.message }); }
}
return [{ json: { boards, taskIndex } }];
