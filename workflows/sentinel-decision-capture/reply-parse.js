const out = $input.first().json;
const raw = out.text || out.output || '';
const src = $('Build Reply Prompt').first().json;
let verdict = null, reason = null;
const m = raw.match(/\{[\s\S]*\}/);
if (m) { try { const o = JSON.parse(m[0]); verdict = o.verdict || null; reason = o.reason || null; } catch (e) {} }
return [{ json: { ts: src.thread_ts, verdict, reason, raw: src.text, via: 'slack_reply' } }];
