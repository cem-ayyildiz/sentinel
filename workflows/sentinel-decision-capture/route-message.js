const m = $('Route Event').first().json;
if (m.mode !== 'message') return [];
const sig = $input.first().json.signal_id;
if (sig) return [{ json: { kind: 'reply', thread_ts: m.thread_ts, text: m.text } }];
return [{ json: { kind: 'question', text: m.text, thread_ts: m.thread_ts || '' } }];
