// Send briefing to Cem's DM. Slack caps messages ~4000 chars, so split at
// paragraph boundaries and post overflow as threaded replies (keeps each
// day's briefing as one tidy, collapsible unit).
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

const chunks = chunk(text, MAX);
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
