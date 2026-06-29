const action = $input.first().json;   // from Lookup Action (id, org, payload, status)
if (!action || !action.id || action.status !== 'pending') return [];
const approved = $('Map Approval').first().json.approved;
const CK = '__CLICKUP_API_KEY__';
const TOKEN = '__SLACK_BOT_TOKEN__'; const CH = 'D0BBRKKPGUE';
const listMap = { freshsens: '901524068347', gohm: '901524068348', diefi: '1000360000000408' };
const teamId = { freshsens: '9009068877', gohm: '42085420', diefi: '9014647941' };
// Resolve an assignee name -> ClickUp user id within the org's team (mirrors the chat flow).
let _teams = null;
const resolveAssignee = async (name, org) => {
  if (!name) return null;
  try {
    if (!_teams) { const r = await this.helpers.httpRequest({ method: 'GET', url: 'https://api.clickup.com/api/v2/team', headers: { Authorization: CK } }); _teams = (typeof r === 'string' ? JSON.parse(r) : r).teams || []; }
    const team = _teams.find(t => t.id === teamId[org]); const users = (team && team.members || []).map(m => m.user);
    const n = String(name).toLowerCase().trim();
    const hit = users.find(u => (u.username || '').toLowerCase().includes(n.split(' ')[0]) || n.includes((u.username || '').toLowerCase().split(' ')[0]));
    return hit ? hit.id : null;
  } catch (e) { return null; }
};
const post = (text) => this.helpers.httpRequest({ method: 'POST', url: 'https://slack.com/api/chat.postMessage',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: { channel: CH, text, unfurl_links: false }, json: true });
if (!approved) { try { await post('🚫 Task skipped.'); } catch (e) {} return [{ json: { id: action.id, status: 'rejected', url: null } }]; }
const p = typeof action.payload === 'string' ? JSON.parse(action.payload) : action.payload;
// Registry routing: if the proposal chose a target space, create in that space's active-sprint
// (or first) list. Falls back to the per-org Sentinel Inbox list when no space was resolved.
let list = listMap[action.org] || listMap.freshsens;
if (p && p.space_id) {
  try {
    const J = (r) => typeof r === 'string' ? JSON.parse(r) : r;
    const H = { Authorization: CK };
    let lists = (J(await this.helpers.httpRequest({ method: 'GET', url: `https://api.clickup.com/api/v2/space/${p.space_id}/list?archived=false`, headers: H })).lists) || [];
    const folders = (J(await this.helpers.httpRequest({ method: 'GET', url: `https://api.clickup.com/api/v2/space/${p.space_id}/folder?archived=false`, headers: H })).folders) || [];
    for (const f of folders) lists = lists.concat(f.lists || []);
    const now = Date.now();
    const pick = lists.find(l => l.start_date && l.due_date && Number(l.start_date) <= now && now <= Number(l.due_date)) || lists[0];
    if (pick) list = pick.id;
  } catch (e) { /* keep inbox fallback */ }
}
// Owner: use the drafted assignee_hint, falling back to Cem so tasks are never ownerless.
let ownerId = await resolveAssignee(p.assignee_hint, action.org);
if (!ownerId) ownerId = await resolveAssignee('Cem', action.org);
const body = { name: p.title, description: p.description || '' };
if (ownerId) body.assignees = [ownerId];
let url = null, status = 'done';
try {
  const r = await this.helpers.httpRequest({ method: 'POST', url: `https://api.clickup.com/api/v2/list/${list}/task`,
    headers: { Authorization: CK, 'Content-Type': 'application/json' }, body, json: true });
  url = r.url || null;
  await post(`✅ Created in ClickUp · _${action.org}_: <${url}|${p.title}>`);
} catch (e) { status = 'failed'; try { await post('⚠️ Couldn’t create the task: ' + e.message); } catch (e2) {} }
return [{ json: { id: action.id, status, url } }];
