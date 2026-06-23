const items = $input.all().map(i => i.json).filter(s => s && s.id);
let profile = {};
try { profile = $('Load Profile').first().json.profile || {}; } catch (e) {}
const lines = items.map((s, i) =>
  `${i + 1}. [${s.type}|${s.org || '?'}] "${s.title}" from ${(s.actor || '?').replace(/<.*>/, '').trim()} — ${(s.body || '').replace(/\s+/g, ' ').substring(0, 120)}`
).join('\n');
const prompt = `You pre-screen Cem's triage queue against his learned profile. Auto-handle ONLY clear, high-confidence noise he reliably skips; surface everything else for him to decide.

His learned profile (standing rules):
${JSON.stringify(profile)}

Candidates:
${lines || '(none)'}

For each candidate, in order, decide:
- "auto_skip": true ONLY if it clearly matches an always_skip rule with HIGH confidence (obvious recurring noise). When in any doubt, false.
- "hint": if surfacing AND it plausibly matches a delegate_map or always_do rule, a short note like "likely delegate to Baran" or "likely do now"; otherwise "".

Return ONLY a JSON array, one object per candidate in the SAME order:
[{"n":1,"auto_skip":false,"hint":""}]`;
return [{ json: { prompt } }];
