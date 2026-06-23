// Build the prompt that asks Claude to compress Cem's verdicts into a decision profile.
const rows = $input.all().map(i => i.json).filter(r => r && r.verdict);
const lines = rows.map(r =>
  `- [${r.verdict}${r.delegate_to ? '→' + r.delegate_to : ''}] ${r.type}/${r.org || '?'}: ${r.title}`
  + ` (from ${r.actor || '?'})${r.reason ? ' — ' + r.reason : ''}`).join('\n');
const prompt = `You compress Cem Ayyildiz's past triage verdicts into a compact decision profile that Sentinel injects into each daily briefing to pre-classify new items.

Cem's recent decisions (newest first):
${lines || '(no decisions yet)'}

From these verdicts, infer his stable patterns. Output ONLY a JSON object, no prose:
{"always_skip": ["clear patterns he reliably skips/archives — sender types, topics, sources"],
 "always_do": ["patterns he reliably acts on immediately"],
 "delegate_map": {"topic or sender pattern": "person/agent he routes it to"}}
Each list: the 5-10 clearest patterns, grounded strictly in the verdicts above. If there's too little data, return small/empty lists rather than guessing.`;
return [{ json: { prompt } }];
