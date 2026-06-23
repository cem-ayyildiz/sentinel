// Post top decidable items as TOP-LEVEL reactable messages (not threaded), so a
// reaction OR a text reply maps to the specific item via its ts. Once per item ever.
const items = $input.all().map(i => i.json).filter(s => s && s.id);
const TOKEN = '__SLACK_BOT_TOKEN__';
const CH = 'D0BBRKKPGUE';
if (!items.length) return [];
const post = (text) => this.helpers.httpRequest({
  method: 'POST', url: 'https://slack.com/api/chat.postMessage',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: { channel: CH, text, unfurl_links: false, unfurl_media: false }, json: true,
});
await post(`🗳️ *Decision Queue* — ${items.length} items. *React* to set a verdict, or *reply* to any item with your reasoning (I'll learn the why).\n`
  + 'Legend: :white_check_mark: do now · :clock3: later · :bust_in_silhouette: delegate · :robot_face: agent · :eyes: watch · :wastebasket: skip');
const out = [];
for (const s of items) {
  const m = s.metadata || {};
  const snip = (s.body || '').replace(/\s+/g, ' ').trim().substring(0, 160);
  let line;
  if (s.type === 'email')
    line = `:email: *${s.title}* — _${(s.actor || '?').replace(/<.*>/, '').trim()}_`
      + (snip ? `\n${snip}` : '') + (s.url ? `\n<${s.url}|↗ open in Gmail>` : '');
  else if (s.type === 'task')
    line = `:white_check_mark: *${s.title}* — overdue${m.priority && m.priority !== 'none' ? ` [${m.priority}]` : ''}`
      + (s.url ? `\n<${s.url}|↗ open task>` : '');
  else line = `• *${s.title}*${snip ? `\n${snip}` : ''}`;
  const r = await post(line);
  if (r && r.ok) out.push({ json: { id: s.id, ts: r.ts } });
}
return out;
