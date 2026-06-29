// Execute ALL action blocks: create_task -> active sprint + real assignees; add_comment -> task.
const raw = $input.first().json.text || $input.first().json.output || '';
const CK = '__CLICKUP_API_KEY__';
const inbox = { freshsens: '901524068347', gohm: '901524068348', diefi: '1000360000000408' };
const sprintFolder = { freshsens: '90090412752' };   // FreshSens Dev "Sprint Folder"
const teamId = { freshsens: '9009068877', gohm: '42085420', diefi: '9014647941' };
const http = (o) => this.helpers.httpRequest(o);

const activeSprintList = async (org) => {
  const fid = sprintFolder[org]; if (!fid) return inbox[org] || inbox.freshsens;
  try {
    const r = await http({ method:'GET', url:`https://api.clickup.com/api/v2/folder/${fid}/list?archived=false`, headers:{Authorization:CK} });
    const d = typeof r==='string'?JSON.parse(r):r; const now = Date.now();
    const cur = (d.lists||[]).find(l => l.start_date && l.due_date && Number(l.start_date)<=now && now<=Number(l.due_date));
    if (cur) return cur.id;
    const fut = (d.lists||[]).filter(l=>l.start_date).sort((a,b)=>Number(b.start_date)-Number(a.start_date));
    return fut.length ? fut[0].id : (inbox[org] || inbox.freshsens);
  } catch (e) { return inbox[org] || inbox.freshsens; }
};
// Registry-driven target space: honor the space the model named, else route by keywords
// (default Management), then create in that space's active-sprint/first list. Without this,
// every freshsens chat task was force-dumped into the Dev sprint folder regardless of intent.
let REG = []; try { REG = ($('Load Registry').first().json.workspaces) || []; } catch (e) {}
const kwHit = (hay, k) => {
  const kk = String(k).toLowerCase().trim();
  if (!kk) return false;
  const re = new RegExp('(^|[^a-z0-9])' + kk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)');
  return re.test(hay);
};
const pickSpace = (org, action) => {
  const sp = REG.filter(r => r.kind === 'clickup_space' && r.org === org);
  if (!sp.length) return null;
  const def = sp.find(s => /management/i.test(s.name || '')) || sp[0];
  if (action.space) {   // the model explicitly named a space
    const w = String(action.space).toLowerCase().trim();
    const m = sp.find(s => (s.name || '').toLowerCase() === w)
           || sp.find(s => { const n = (s.name || '').toLowerCase(); return n && (n.includes(w) || w.includes(n)); });
    if (m) return m;
  }
  const hay = ((action.title || '') + ' ' + (action.description || '')).toLowerCase();
  let best = null, sc = 0;
  for (const s of sp) {
    const kws = (s.config && s.config.routing_keywords) || [];
    const n = kws.filter(k => kwHit(hay, k)).length;
    if (n > sc || (n === sc && n > 0 && s === def)) { sc = n; best = s; }
  }
  return best || def;
};
const listInSpace = async (spaceId) => {
  try {
    const J = (r) => typeof r === 'string' ? JSON.parse(r) : r; const H = { Authorization: CK };
    let lists = (J(await http({ method:'GET', url:`https://api.clickup.com/api/v2/space/${spaceId}/list?archived=false`, headers:H })).lists) || [];
    const folders = (J(await http({ method:'GET', url:`https://api.clickup.com/api/v2/space/${spaceId}/folder?archived=false`, headers:H })).folders) || [];
    for (const f of folders) lists = lists.concat(f.lists || []);
    const now = Date.now();
    const pick = lists.find(l => l.start_date && l.due_date && Number(l.start_date) <= now && now <= Number(l.due_date)) || lists[0];
    return pick ? pick.id : null;
  } catch (e) { return null; }
};
const resolveTargetList = async (org, action) => {
  const space = pickSpace(org, action);
  if (space) { const lid = await listInSpace(space.id); if (lid) return { list: lid, space: space.name }; }
  return { list: await activeSprintList(org), space: null };   // fall back to old behavior
};
let _members = null;
const resolveAssignee = async (name, org) => {
  if (!name) return null;
  try {
    if (!_members) { const r = await http({ method:'GET', url:'https://api.clickup.com/api/v2/team', headers:{Authorization:CK} }); _members = (typeof r==='string'?JSON.parse(r):r).teams || []; }
    const team = _members.find(t => t.id === teamId[org]); const users = (team?.members || []).map(m => m.user);
    let n = name.toLowerCase().trim();
    if (['me','myself','i','cem','ca','cem ayyildiz'].includes(n)) n = 'cem';   // self-alias -> Cem Ayyildiz
    const hit = users.find(u => (u.username||'').toLowerCase().includes(n.split(' ')[0]) || n.includes((u.username||'').toLowerCase().split(' ')[0]));
    return hit ? hit.id : null;
  } catch (e) { return null; }
};

let prose = raw; const actions = [];
for (const b of raw.matchAll(/```json\s*([\s\S]*?)```/gi)) { prose = prose.replace(b[0], ''); try { const a = JSON.parse(b[1].trim()); Array.isArray(a)?actions.push(...a):actions.push(a); } catch (e) {} }
prose = prose.replace(/\n{3,}/g, '\n\n').trim();
const results = [];
for (const action of actions) {
  try {
    if (action.action === 'create_task' && action.title) {
      const org = action.org || 'freshsens';
      const tgt = await resolveTargetList(org, action);
      const list = tgt.list;
      const names = Array.isArray(action.assignees) ? action.assignees.filter(Boolean) : (action.assignee ? [action.assignee] : []);
      const ids = []; const named = [];
      for (const nm of names) { const id = await resolveAssignee(nm, org); if (id && !ids.includes(id)) { ids.push(id); named.push(nm); } }
      const fnames = Array.isArray(action.followers) ? action.followers.filter(Boolean) : (action.follower ? [action.follower] : []);
      const fids = []; const fnamed = [];
      for (const nm of fnames) { const id = await resolveAssignee(nm, org); if (id && !fids.includes(id)) { fids.push(id); fnamed.push(nm); } }
      const body = { name: action.title, description: `${action.description || ''}\n\n_(via Sentinel chat)_` };
      if (ids.length) body.assignees = ids;
      const r = await http({ method:'POST', url:`https://api.clickup.com/api/v2/list/${list}/task`, headers:{Authorization:CK,'Content-Type':'application/json'}, body, json:true });
      // Add followers as watchers (the create payload ignores watchers; PUT add does work). Assignees are auto-watchers, so skip those.
      const extra = fids.filter(id => !ids.includes(id));
      if (extra.length && r && r.id) {
        try { await http({ method:'PUT', url:`https://api.clickup.com/api/v2/task/${r.id}`, headers:{Authorization:CK,'Content-Type':'application/json'}, body:{ watchers:{ add: extra, rem: [] } }, json:true }); }
        catch (e) { fnamed.length = 0; results.push(`⚠️ couldn't add followers: ${e.message}`); }
      }
      results.push(`✅ Created${tgt.space?` in ${tgt.space}`:''}${named.length?` (assigned to ${named.join(', ')})`:''}${fnamed.length?` · following: ${fnamed.join(', ')}`:''}: <${r.url}|${(action.title||'').substring(0,40)}>`);
    } else if (action.action === 'add_comment' && action.task_id && action.comment) {
      await http({ method:'POST', url:`https://api.clickup.com/api/v2/task/${action.task_id}/comment`, headers:{Authorization:CK,'Content-Type':'application/json'}, body:{comment_text:action.comment, notify_all:false}, json:true });
      results.push(`✅ Comment → <https://app.clickup.com/t/${action.task_id}|${action.task_id}>`);
    }
  } catch (e) { results.push(`⚠️ ${action.action} failed: ${e.message}`); }
}
return [{ json: { text: prose + (results.length ? '\n\n' + results.join('\n') : '') } }];
