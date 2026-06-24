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
const list = listMap[action.org] || listMap.freshsens;
let url = null, status = 'done';
try {
  const r = await this.helpers.httpRequest({ method: 'POST', url: `https://api.clickup.com/api/v2/list/${list}/task`,
    headers: { Authorization: CK, 'Content-Type': 'application/json' }, body: { name: p.title, description: p.description || '' }, json: true });
  url = r.url || null;
  await post(`✅ Created in ClickUp · _${action.org}_: <${url}|${p.title}>`);
} catch (e) { status = 'failed'; try { await post('⚠️ Couldn’t create the task: ' + e.message); } catch (e2) {} }
return [{ json: { id: action.id, status, url } }];
