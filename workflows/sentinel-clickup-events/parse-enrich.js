// Parse a ClickUp webhook (taskStatusUpdated | taskAssigneeUpdated) into ledger rows.
// One row per history_item; enriches with task name/list/points/org via a task GET.
const b = $input.first().json.body || $input.first().json;
const items = b.history_items || [];
if (!b.task_id || !items.length) return [];
const CK = '__CLICKUP_API_KEY__';
const J = (r) => typeof r === 'string' ? JSON.parse(r) : r;
let task = {};
try { task = J(await this.helpers.httpRequest({ method:'GET', url:`https://api.clickup.com/api/v2/task/${b.task_id}`, headers:{ Authorization: CK } })); } catch (e) {}
const spaceOrg = { '90090136601':'freshsens', '90010053606':'freshsens', '90152680846':'freshsens', '90155478263':'freshsens', '90159399897':'freshsens' };
const org = spaceOrg[(task.space||{}).id] || 'freshsens';
const rows = [];
for (const hi of items) {
  const f = hi.field;
  const isAssignee = (f === 'assignee_add' || f === 'assignee_rem' || f === 'assignee');
  if (f !== 'status' && !isAssignee) continue;
  let before_val = null, after_val = null, assignee_user = null;
  if (f === 'status') { before_val = (hi.before||{}).status || null; after_val = (hi.after||{}).status || null; }
  else { const add = hi.after, rm = hi.before; after_val = add?add.username:null; before_val = rm?rm.username:null; assignee_user = (add||rm||{}).username || null; }
  rows.push({ json: {
    task_id: b.task_id, task_name: task.name || null, org,
    list_id: (task.list||{}).id || null, list_name: (task.list||{}).name || null,
    event: b.event, field: f, before_val, after_val, assignee_user,
    points: (task.points==null ? null : Number(task.points)),
    actor: (hi.user||{}).username || null,
    event_time: hi.date ? new Date(Number(hi.date)).toISOString() : null,
    raw: hi
  }});
}
return rows;
