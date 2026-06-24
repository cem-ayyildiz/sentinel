const raw = $input.first().json.text || $input.first().json.output || '';
const items = $('Load Actionable').all().map(i => i.json).filter(s => s && s.id);
let drafts = []; const m = raw.match(/\[[\s\S]*\]/); if (m) { try { drafts = JSON.parse(m[0]); } catch (e) {} }
const byN = {}; drafts.forEach(d => { byN[d.n] = d; });
const TOKEN = '__SLACK_BOT_TOKEN__'; const CH = 'D0BBRKKPGUE';
const post = (text) => this.helpers.httpRequest({ method: 'POST', url: 'https://slack.com/api/chat.postMessage',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: { channel: CH, text, unfurl_links: false }, json: true });
const out = [];
for (let i = 0; i < items.length; i++) {
  const s = items[i]; const d = byN[i + 1] || {};
  const title = (d.title || s.title || 'Task').substring(0, 80);
  const desc = `${d.description || ''}\n\n— From: ${s.actor || ''}\n— Source: ${s.url || ''}\n— Cem's note: ${s.reason || '(reaction)'}`;
  const text = `📋 *Create ClickUp task* · _${s.org}_\n*${title}*\n${d.description || ''}\n👤 ${d.assignee_hint || '—'}  ·  📅 ${d.due_hint || '—'}\n_react ✅ to create · ❌ to skip_`;
  const r = await post(text);
  if (r && r.ok) out.push({ json: { signal_id: s.id, org: s.org, payload: JSON.stringify({ title, description: desc, assignee_hint: d.assignee_hint || null, due: d.due_hint || null }), slack_ts: r.ts } });
}
return out;
