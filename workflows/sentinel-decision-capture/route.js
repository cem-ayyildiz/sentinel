// Route incoming Slack event: challenge (setup) vs reaction vs ignore.
const b = $input.first().json.body || $input.first().json;
if (b && b.type === 'url_verification') return [{ json: { mode: 'challenge', challenge: b.challenge } }];
const ev = b && b.event;
if (ev && ev.type === 'reaction_added' && ev.item && ev.item.ts)
  return [{ json: { mode: 'reaction', ts: ev.item.ts, channel: ev.item.channel, reaction: ev.reaction, user: ev.user } }];
return [{ json: { mode: 'ignore' } }];
