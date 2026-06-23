// Transparency: tell Cem what the rules auto-hid, so he can catch over-filtering.
const items = $input.all().map(i => i.json).filter(s => s && s.id);
const TOKEN = '__SLACK_BOT_TOKEN__';
const CH = 'D0BBRKKPGUE';
if (items.length) {
  const list = items.map(s => `• ${(s.title || '').substring(0, 55)}${s.hint ? `  _(${s.hint})_` : ''}`).join('\n');
  try {
    await this.helpers.httpRequest({ method: 'POST', url: 'https://slack.com/api/chat.postMessage',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: { channel: CH, unfurl_links: false,
        text: `🔇 *Auto-handled ${items.length} item(s)* by your learned rules (kept off the queue):\n${list}\n_If any of these should NOT have been skipped, tell me and I'll loosen that rule._` },
      json: true });
  } catch (e) {}
}
return items.map(json => ({ json }));
