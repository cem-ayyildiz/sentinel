// Decide: is this message a reply to a QUEUE ITEM (-> triage decision) or a question (-> chat)?
const m = $('Route Event').first().json;
if (m.mode !== 'message') return [];
const sig = $input.first().json.signal_id;   // from Lookup Queue Reply (null if not a queue item)
if (sig) return [{ json: { kind: 'reply', thread_ts: m.thread_ts, text: m.text } }];
return [{ json: { kind: 'question', text: m.text } }];
