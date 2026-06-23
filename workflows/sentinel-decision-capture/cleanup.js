// After a decision is recorded, remove the item's message so the board self-clears.
const re = $('Route Event').first().json;
const ts = re.ts || re.thread_ts;
const TOKEN = '__SLACK_BOT_TOKEN__';
const CH = 'D0BBRKKPGUE';
if (ts) {
  try {
    await this.helpers.httpRequest({
      method: 'POST', url: 'https://slack.com/api/chat.delete',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: { channel: CH, ts }, json: true,
    });
  } catch (e) { /* already gone */ }
}
return [{ json: { cleaned: ts || null } }];
