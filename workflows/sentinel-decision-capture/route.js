const b = $input.first().json.body || $input.first().json;
if (b && b.type === 'url_verification') return [{ json: { mode: 'challenge', challenge: b.challenge } }];
const ev = b && b.event;
if (!ev) return [{ json: { mode: 'ignore' } }];
if (ev.type === 'reaction_added' && ev.item && ev.item.ts)
  return [{ json: { mode: 'reaction', ts: ev.item.ts, reaction: ev.reaction } }];
if (ev.type === 'message' && ev.text && !ev.bot_id && ev.subtype === undefined)
  return [{ json: { mode: 'message', ts: ev.ts, thread_ts: ev.thread_ts || '', text: ev.text } }];
return [{ json: { mode: 'ignore' } }];
