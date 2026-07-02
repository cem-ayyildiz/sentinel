// Send briefing to Cem's DM. The COCKPIT (everything before the first divider) is THE
// message — the per-company detail goes into the thread, so the DM stays scannable.
// Slack caps messages ~4000 chars, so oversize parts still split at paragraph boundaries.
const text = $input.first().json.text;
const TOKEN = '__SLACK_BOT_TOKEN__';
const CHANNEL = 'D0BBRKKPGUE';
const MAX = 3800;

const chunk = (s, max) => {
  const parts = [];
  let rest = s.trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n\n', max);
    if (cut < max * 0.5) cut = rest.lastIndexOf('\n', max);
    if (cut < max * 0.5) cut = max;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
};

// Split cockpit from company detail at the first divider line (─ x many).
const div = text.match(/\n─{5,}\s*\n/);
let main = text, detail = '';
if (div && div.index > 200) {
  main = text.slice(0, div.index).trim();
  detail = text.slice(div.index).trim();
}
let chunks = chunk(main, MAX).concat(detail ? chunk(detail, MAX) : []);
if (chunks.length > 1) chunks[0] += '\n\n_🧵 full company detail in the thread_';
let threadTs = null;
const sent = [];
for (let i = 0; i < chunks.length; i++) {
  const body = { channel: CHANNEL, text: chunks[i] };
  if (threadTs) body.thread_ts = threadTs;
  const resp = await this.helpers.httpRequest({
    method: 'POST',
    url: 'https://slack.com/api/chat.postMessage',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body,
    json: true,
  });
  if (!resp.ok) throw new Error('Slack error: ' + resp.error);
  if (!threadTs) threadTs = resp.ts;
  sent.push(resp.ts);
}
return [{ json: { ok: true, channel: CHANNEL, parts: sent.length, ts: sent } }];
