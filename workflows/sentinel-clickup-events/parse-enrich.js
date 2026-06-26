// Parse a ClickUp webhook into ledger rows. Handles:
//  - taskStatusUpdated / taskAssigneeUpdated  -> status / assignee_add / assignee_rem rows
//  - taskCommentPosted -> Multica agent markers (the agent is identified from comments, NOT the assignee field)
const b = $input.first().json.body || $input.first().json;
const event = b.event || '';
if (!b.task_id) return [];
const CK = '__CLICKUP_API_KEY__';
const J = (r) => typeof r === 'string' ? JSON.parse(r) : r;
const http = (url) => this.helpers.httpRequest({ method:'GET', url, headers:{ Authorization: CK } });
let task = {};
try { task = J(await http(`https://api.clickup.com/api/v2/task/${b.task_id}`)); } catch (e) {}
const spaceOrg = { '90090136601':'freshsens', '90010053606':'freshsens', '90152680846':'freshsens', '90155478263':'freshsens', '90159399897':'freshsens' };
const org = spaceOrg[(task.space||{}).id] || 'freshsens';
const base = { task_id:b.task_id, task_name:task.name||null, org, list_id:(task.list||{}).id||null, list_name:(task.list||{}).name||null, event, points:(task.points==null?null:Number(task.points)) };

if (event === 'taskCommentPosted') {
  let ctext='', cdate=null, cuser=null;
  try { let cs = (J(await http(`https://api.clickup.com/api/v2/task/${b.task_id}/comment`)).comments)||[];
        cs.sort((a,b)=>Number(b.date)-Number(a.date)); const c=cs[0];
        if (c) { ctext=c.comment_text||''; cdate=c.date; cuser=(c.user||{}).username; } } catch (e) {}
  // Multica markers: delivery = "MR opened for review"; also synced / working / needs_clarification
  const markers = [[/MR opened for review|merge_requests\/\d+/i,'agent_mr'],[/needs_clarification/i,'agent_clarify'],[/synced to Multica/i,'agent_synced'],[/Multica update|Status:\s*`?in_progress/i,'agent_working']];
  let sig=null; for (const m of markers) { if (m[0].test(ctext)) { sig=m[1]; break; } }
  if (!sig) return [];
  const mr = (ctext.match(/https?:\/\/gitlab\.gohm\.tech\/\S+\/merge_requests\/\d+/)||[])[0] || null;
  const fre = (ctext.match(/FRE-\d+/)||[])[0] || null;
  return [{ json: { ...base, field:sig, before_val:fre, after_val:mr, assignee_user:cuser, actor:cuser,
    event_time: cdate ? new Date(Number(cdate)).toISOString() : null, raw:{ text:String(ctext).slice(0,600), fre, mr } } }];
}

const items = b.history_items || [];
const rows = [];
for (const hi of items) {
  const f = hi.field;
  const isAssignee = (f==='assignee_add'||f==='assignee_rem'||f==='assignee');
  if (f !== 'status' && !isAssignee) continue;
  let before_val=null, after_val=null, assignee_user=null;
  if (f==='status') { before_val=(hi.before||{}).status||null; after_val=(hi.after||{}).status||null; }
  else { const add=hi.after, rm=hi.before; after_val=add?add.username:null; before_val=rm?rm.username:null; assignee_user=(add||rm||{}).username||null; }
  rows.push({ json: { ...base, field:f, before_val, after_val, assignee_user, actor:(hi.user||{}).username||null,
    event_time: hi.date ? new Date(Number(hi.date)).toISOString() : null, raw:hi } });
}
return rows;
