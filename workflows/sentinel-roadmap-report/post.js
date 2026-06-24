const body = $input.first().json.text || $input.first().json.output || '(no report)';
const text = `*🎯 Sentinel · Weekly Roadmap Report*\n\n${body}`;
const TOKEN = '__SLACK_BOT_TOKEN__'; const CH = 'D0BBRKKPGUE'; const MAX = 3800;
const chunk = (s) => { const p = []; let r = s.trim(); while (r.length > MAX) { let c = r.lastIndexOf('\n\n', MAX); if (c < MAX * 0.5) c = r.lastIndexOf('\n', MAX); if (c < MAX * 0.5) c = MAX; p.push(r.slice(0, c).trim()); r = r.slice(c).trim(); } if (r) p.push(r); return p; };
let thread = null;
for (const part of chunk(text)) {
  const b = { channel: CH, text: part, unfurl_links: false }; if (thread) b.thread_ts = thread;
  const resp = await this.helpers.httpRequest({ method: 'POST', url: 'https://slack.com/api/chat.postMessage', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: b, json: true });
  if (!thread && resp.ok) thread = resp.ts;
}
return [{ json: { ok: true } }];
