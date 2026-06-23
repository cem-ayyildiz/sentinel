const items = $input.all().map(i => i.json).filter(s => s && s.id);
const TOKEN = '__SLACK_BOT_TOKEN__';
const CH = 'D0BBRKKPGUE';
if (!items.length) return [];
const post = (text) => this.helpers.httpRequest({ method: 'POST', url: 'https://slack.com/api/chat.postMessage',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: { channel: CH, text, unfurl_links: false, unfurl_media: false }, json: true });
const out = [];
for (const s of items) {
  const m = s.metadata || {};
  const snip = (s.body || '').replace(/\s+/g, ' ').trim().substring(0, 150);
  const hint = s.hint ? `   _(${s.hint})_\n` : '';
  let line;
  if (s.type === 'email') line = `:email: *${s.title}* — _${(s.actor || '?').replace(/<.*>/, '').trim()}_\n${hint}${snip}${s.url ? `\n<${s.url}|↗ open in Gmail>` : ''}`;
  else if (s.type === 'task') line = `:white_check_mark: *${s.title}* — overdue${m.priority && m.priority !== 'none' ? ` [${m.priority}]` : ''}\n${hint}${s.url ? `<${s.url}|↗ open task>` : ''}`;
  else line = `• *${s.title}*\n${hint}${snip}`;
  const r = await post(line);
  if (r && r.ok) out.push({ json: { id: s.id, ts: r.ts } });
}
return out;
