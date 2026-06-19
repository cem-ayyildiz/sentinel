// ===== Recall Yesterday — pull the last briefing from Cem's DM for continuity =====
// Lets Sentinel compare today vs. yesterday: what's still open, resolved, or new.
const data = $input.first().json;
const TOKEN = '__SLACK_BOT_TOKEN__';
const CHANNEL = 'D0BBRKKPGUE';

let yesterdayBriefing = '';
try {
  const resp = await this.helpers.httpRequest({
    method: 'GET',
    url: `https://slack.com/api/conversations.history?channel=${CHANNEL}&limit=15`,
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const d = typeof resp === 'string' ? JSON.parse(resp) : resp;
  const msg = (d.messages || []).find(m => (m.text || '').includes('Sentinel Daily Briefing'));
  if (msg) {
    let full = msg.text || '';
    try {
      const rep = await this.helpers.httpRequest({
        method: 'GET',
        url: `https://slack.com/api/conversations.replies?channel=${CHANNEL}&ts=${msg.ts}`,
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      const rd = typeof rep === 'string' ? JSON.parse(rep) : rep;
      const parts = (rd.messages || []).map(x => x.text || '');
      if (parts.length > 1) full = parts.join('\n');
    } catch (e) { /* no thread */ }
    yesterdayBriefing = full.substring(0, 3500);
  }
} catch (e) {
  data.errors = data.errors || [];
  data.errors.push('Recall: ' + e.message);
}
data.yesterdayBriefing = yesterdayBriefing;
return [{ json: data }];
