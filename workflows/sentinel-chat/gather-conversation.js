const wh = $('Chat In').first().json;
const thread = (wh.body && wh.body.thread_ts) || (wh.query && wh.query.thread_ts) || '';
const TOKEN = '__SLACK_BOT_TOKEN__'; const CH = 'D0BBRKKPGUE';
let msgs = [];
try {
  const url = thread
    ? `https://slack.com/api/conversations.replies?channel=${CH}&ts=${thread}&limit=25`
    : `https://slack.com/api/conversations.history?channel=${CH}&limit=16`;
  const r = await this.helpers.httpRequest({ method: 'GET', url, headers: { Authorization: `Bearer ${TOKEN}` } });
  const d = typeof r === 'string' ? JSON.parse(r) : r;
  msgs = (d.messages || []).filter(m => (m.text || '').trim());
  if (!thread) msgs = msgs.reverse();   // history is newest-first -> make chronological
} catch (e) {}
const transcript = msgs.slice(-14).map(m => {
  const who = (m.bot_id || m.app_id) ? 'Sentinel' : 'Cem';
  const t = (m.text || '').replace(/^:speech_balloon:\s*/, '').replace(/💬\s*/, '').replace(/\s+/g, ' ').substring(0, 600);
  return `${who}: ${t}`;
}).join('\n');
return [{ json: { transcript } }];
