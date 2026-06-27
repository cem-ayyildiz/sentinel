const action = $input.first().json;   // from Lookup Action (id, org, payload, status)
if (!action || !action.id || action.status !== 'pending') return [];
const approved = $('Map Approval').first().json.approved;
const CK = '__CLICKUP_API_KEY__';
const TOKEN = '__SLACK_BOT_TOKEN__'; const CH = 'D0BBRKKPGUE';
const listMap = { freshsens: '901524068347', gohm: '901524068348', diefi: '1000360000000408' };
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
let url = null, status = 'done';
try {
  const r = await this.helpers.httpRequest({ method: 'POST', url: `https://api.clickup.com/api/v2/list/${list}/task`,
    headers: { Authorization: CK, 'Content-Type': 'application/json' }, body: { name: p.title, description: p.description || '' }, json: true });
  url = r.url || null;
  await post(`✅ Created in ClickUp · _${action.org}_: <${url}|${p.title}>`);
} catch (e) { status = 'failed'; try { await post('⚠️ Couldn’t create the task: ' + e.message); } catch (e2) {} }
return [{ json: { id: action.id, status, url } }];
