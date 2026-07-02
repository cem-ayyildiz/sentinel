// Parse a ClickUp webhook into ledger rows. Handles:
//  - taskStatusUpdated / taskAssigneeUpdated  -> status / assignee_add / assignee_rem rows  (_table: clickup_events)
//  - taskCommentPosted -> (a) EVERY human comment row (_table: clickup_comments) for the daily
//                             "new comments + progress" view, AND
//                         (b) a Multica agent-marker row (_table: clickup_events) when the comment
//                             carries an agent lifecycle marker (agent is identified from comments,
//                             NOT the assignee field).
//
// Each output row carries `_table` so the downstream Switch routes it to the right Postgres insert:
//   _table === 'clickup_comments' -> Insert Comments node
//   else                          -> Insert Events node
const b = $input.first().json.body || $input.first().json;
const event = b.event || '';
if (!b.task_id) return [];
const CK = '__CLICKUP_API_KEY__';
const J = (r) => typeof r === 'string' ? JSON.parse(r) : r;
const http = (url) => this.helpers.httpRequest({ method:'GET', url, headers:{ Authorization: CK } });
let task = {};
try { task = J(await http(`https://api.clickup.com/api/v2/task/${b.task_id}`)); } catch (e) {}

// space id -> org, mirrors infra/workspaces.json (single source of truth for the mapping).
// Previously only the 5 FreshSens spaces were listed, so GOHM/DIEFI events were mislabeled 'freshsens'.
const SPACE_ORG = {
  // FreshSens
  '90090136601':'freshsens', '90010053606':'freshsens', '90152680846':'freshsens',
  '90155478263':'freshsens', '90159399897':'freshsens', '901511184184':'freshsens',
  // GOHM (gohm-diefi + Villa Kurt Development live in the GOHM team — added 2026-07-02)
  '90090428426':'gohm', '90151309240':'gohm', '901511313936':'gohm', '901511300841':'gohm',
  // DIEFI
  '90143023495':'diefi',
};
const spaceId = (task.space||{}).id || null;
const org = SPACE_ORG[spaceId] || (b.team_id === '9014647941' ? 'diefi' : (b.team_id === '42085420' ? 'gohm' : 'freshsens'));
const base = { task_id:b.task_id, task_name:task.name||null, org, space_id:spaceId,
  list_id:(task.list||{}).id||null, list_name:(task.list||{}).name||null, event,
  points:(task.points==null?null:Number(task.points)) };

// Agent account: "Agent Multica" (user id 106715754) or the Şevval integration token.
const AGENT_RE = /multica|şevval|sevval/i;
const MARKERS = [[/MR opened for review|merge_requests\/\d+/i,'agent_mr'],[/needs_clarification/i,'agent_clarify'],[/synced to Multica/i,'agent_synced'],[/Multica update|Status:\s*`?in_progress/i,'agent_working']];

if (event === 'taskCommentPosted') {
  let ctext='', cdate=null, cuser=null, cid=null;
  try { let cs = (J(await http(`https://api.clickup.com/api/v2/task/${b.task_id}/comment`)).comments)||[];
        cs.sort((a,b)=>Number(b.date)-Number(a.date)); const c=cs[0];
        if (c) { ctext=c.comment_text||''; cdate=c.date; cuser=(c.user||{}).username; cid=c.id; } } catch (e) {}
  const out = [];
  // (a) ALWAYS log the comment itself (powers the daily Development comments view).
  if (ctext) {
    const isAgent = AGENT_RE.test(String(cuser||'')) || MARKERS.some(m => m[0].test(ctext));
    out.push({ json: { _table:'clickup_comments', comment_id: cid ? String(cid) : null,
      task_id: base.task_id, task_name: base.task_name, org: base.org, space_id: base.space_id,
      list_id: base.list_id, list_name: base.list_name, commenter: cuser, text: String(ctext).slice(0,2000),
      is_agent: isAgent, commented_at: cdate ? new Date(Number(cdate)).toISOString() : null } });
  }
  // (b) If it carries an agent lifecycle marker, also emit the ledger event row.
  let sig=null; for (const m of MARKERS) { if (m[0].test(ctext)) { sig=m[1]; break; } }
  if (sig) {
    const mr = (ctext.match(/https?:\/\/gitlab\.gohm\.tech\/\S+\/merge_requests\/\d+/)||[])[0] || null;
    const fre = (ctext.match(/FRE-\d+/)||[])[0] || null;
    out.push({ json: { _table:'clickup_events', ...base, field:sig, before_val:fre, after_val:mr,
      assignee_user:cuser, actor:cuser, event_time: cdate ? new Date(Number(cdate)).toISOString() : null,
      raw:{ text:String(ctext).slice(0,600), fre, mr } } });
  }
  return out;
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
  rows.push({ json: { _table:'clickup_events', ...base, field:f, before_val, after_val, assignee_user, actor:(hi.user||{}).username||null,
    event_time: hi.date ? new Date(Number(hi.date)).toISOString() : null, raw:hi } });
}
return rows;
