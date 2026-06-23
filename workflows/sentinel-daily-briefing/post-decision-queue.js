// ===== Post Decision Queue — surface top decidable items as reactable messages =====
// Each threaded message = one signal; its ts is saved (Update Slack TS) so a
// reaction maps back to the signal via Decision Capture. Posted once per item (ever).
const items = $input.all().map(i => i.json).filter(s => s && s.id);
const TOKEN = '__SLACK_BOT_TOKEN__';
const CH = 'D0BBRKKPGUE';
if (!items.length) return [];

const post = (body) => this.helpers.httpRequest({
  method: 'POST', url: 'https://slack.com/api/chat.postMessage',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body, json: true,
});

const header = await post({ channel: CH,
  text: '🗳️ *Decision Queue* — react to teach Sentinel how you triage.\n'
    + 'Legend: :white_check_mark: do now · :clock3: later · :bust_in_silhouette: delegate · :robot_face: agent · :eyes: watch · :wastebasket: skip' });
const thread = header.ts;

const out = [];
for (const s of items) {
  const m = s.metadata || {};
  let line;
  if (s.type === 'email') line = `📨 *${s.title}* — from ${s.actor || '?'}${s.url ? ` <${s.url}|open>` : ''}`;
  else if (s.type === 'task') line = `✅ *${s.title}* — overdue${m.priority && m.priority !== 'none' ? ` [${m.priority}]` : ''}${s.url ? ` <${s.url}|open>` : ''}`;
  else line = `• *${s.title}*`;
  const r = await post({ channel: CH, thread_ts: thread, text: line });
  if (r && r.ok) out.push({ json: { id: s.id, ts: r.ts } });
}
return out;
