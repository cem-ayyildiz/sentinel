const j = $input.first().json;
if (j.mode !== 'reply') return [];
const prompt = `Cem replied to a triage item with his reasoning. Determine his decision.
His reply: "${j.text}"

Return ONLY JSON: {"verdict":"<one of: do_now, do_later, delegate_person, delegate_agent, watch, skip, done>","reason":"<one concise sentence paraphrasing his reasoning>"}
Pick the single best verdict. If he says he already finished/completed/did it (or it's no longer needed), use "done". If he hands it to someone, use "delegate_person" and name them. If he dismisses it as noise, use "skip".`;
return [{ json: { prompt, thread_ts: j.thread_ts, text: j.text } }];
