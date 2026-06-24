const items = $input.all().map(i => i.json).filter(s => s && s.id);
const TOKEN = '__SLACK_BOT_TOKEN__';
const CH = 'D0BBRKKPGUE';
if (items.length) {
  const list = items.map(s => `• [${s.verdict}] ${(s.title || '').substring(0, 50)}${s.hint ? `  _(${s.hint})_` : ''}`).join('\n');
  try {
    await this.helpers.httpRequest({ method: 'POST', url: 'https://slack.com/api/chat.postMessage',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: { channel: CH, unfurl_links: false,
        text: `🔇 *Auto-handled ${items.length}* (confident, no action needed):\n${list}\n_Tell me if I got any wrong._` }, json: true });
  } catch (e) {}
}
return items.map(json => ({ json }));
