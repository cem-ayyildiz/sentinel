const items = $input.all().map(i => i.json).filter(s => s && s.id);
let profile = {};
try { profile = $('Load Profile').first().json.profile || {}; } catch (e) {}
const lines = items.map((s, i) =>
  `${i + 1}. [${s.type}|${s.org || '?'}] "${s.title}" from ${(s.actor || '?').replace(/<.*>/, '').trim()} — ${(s.body || '').replace(/\s+/g, ' ').substring(0, 140)}`
).join('\n');
const prompt = `You triage Cem Ayyildiz's incoming items (CTO of FreshSens, GM of GOHM, lead on DIEFI). Use JUDGMENT — his learned profile below is GUIDANCE, not rigid rules. Reason about each item: auto-handle only what's clearly routine/noise, and surface anything that needs his judgment WITH your suggested call. When you're not sure, surface it and say so.

His learned profile (patterns, for guidance only):
${JSON.stringify(profile)}

Verdicts: do_now (needs him today) · do_later (him, not today) · delegate_person · delegate_agent · watch (track, no action) · skip (noise) · done (already handled / irrelevant).

ALWAYS-SURFACE (NEVER auto_handle these — they are actionable even if they look like routine portal mail):
- Payment / invoice / fee / subscription / balance-due / overdue notices (TR: ödeme, fatura, ücret, aidat, bakiye, vade, son ödeme).
- Deadlines, suspension, cancellation, service-termination or account-closure threats (TR: son tarih, ihtar, askıya alma, iptal, fesih, kapatılacak).
- Legal / contractual / regulatory / official-authority notices (e.g. PTT / KEP, tax office, bank, government, notary).
For any of these: auto_handle=false, verdict = do_now if a deadline is within ~2 weeks else do_later, and put the DEADLINE + amount in the hint (e.g. "PTT KEP fee 215 TL — pay by ~10 Jul or the account is closed"). When unsure whether something is one of these, surface it.

Candidates:
${lines || '(none)'}

For each candidate, in order, return:
- "verdict": your best call (one of the above)
- "confidence": "high" | "medium" | "low"
- "auto_handle": true ONLY when verdict is "skip" or "watch" AND confidence is "high" (clearly nothing for Cem to do). For anything actionable, or any doubt, false.
- "hint": one short line for Cem — your suggestion + why (e.g. "suggest delegate to Baran", "recurring portal digest", "not sure — your call")

Be decisive on obvious noise; surface real decisions with your suggestion so Cem just confirms. Return ONLY a JSON array, one object per candidate in order:
[{"n":1,"verdict":"skip","confidence":"high","auto_handle":true,"hint":"recurring portal digest"}]`;
return [{ json: { prompt } }];
