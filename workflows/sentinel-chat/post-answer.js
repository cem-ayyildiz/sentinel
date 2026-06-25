const ans = $input.first().json.text || $input.first().json.output || '(no answer)';
const wh = $('Chat In').first().json;
const thread = (wh.body && wh.body.thread_ts) || (wh.query && wh.query.thread_ts) || '';
const TOKEN = '__SLACK_BOT_TOKEN__'; const CH = 'D0BBRKKPGUE';
const body = { channel: CH, text: `💬 ${ans}`, unfurl_links: false };
if (thread) body.thread_ts = thread;     // answer in the same thread the question came from
await this.helpers.httpRequest({ method: 'POST', url: 'https://slack.com/api/chat.postMessage',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body, json: true });
return [{ json: { ok: true } }];
