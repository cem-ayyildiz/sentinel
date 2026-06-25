// Count Multica (AI-agent product) issues + who they're from (creator), FreshSens.
const CK = '__CLICKUP_API_KEY__';
const TEAM = '9009068877';
const cutoff = Date.now() - 90 * 86400 * 1000;
let tasks = [];
for (let page = 0; page < 5; page++) {
  const r = await this.helpers.httpRequest({ method: 'GET',
    url: `https://api.clickup.com/api/v2/team/${TEAM}/task?date_updated_gt=${cutoff}&order_by=updated&subtasks=true&include_closed=true&page=${page}`,
    headers: { Authorization: CK } });
  const d = typeof r === 'string' ? JSON.parse(r) : r; const ts = d.tasks || [];
  tasks = tasks.concat(ts); if (ts.length < 100) break;
}
const m = tasks.filter(t => /multica/i.test(t.name || ''));
const byCreator = {}, byStatus = { open: 0, closed: 0 };
for (const t of m) {
  const c = (t.creator || {}).username || '?'; byCreator[c] = (byCreator[c] || 0) + 1;
  const done = ((t.status || {}).type === 'closed' || (t.status || {}).type === 'done');
  byStatus[done ? 'closed' : 'open']++;
}
const sample = m.slice(0, 10).map(t => ({ name: (t.name || '').substring(0, 50), creator: (t.creator || {}).username, status: (t.status || {}).status, assignee: (t.assignees || []).map(a => a.username).join(',') }));
return [{ json: { multica: { total: m.length, byCreator, byStatus, sample } } }];
