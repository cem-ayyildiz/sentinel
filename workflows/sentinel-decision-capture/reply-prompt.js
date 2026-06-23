const j = $input.first().json;
if (j.mode !== 'reply') return [];
const prompt = `Cem replied to a triage item in his briefing with his reasoning. Determine his decision.
His reply: "${j.text}"

Return ONLY JSON: {"verdict":"<one of: do_now, do_later, delegate_person, delegate_agent, watch, skip>","reason":"<one concise sentence paraphrasing his reasoning>"}
Pick the single best verdict his words imply. If he says to hand it to someone, use delegate_person and name them in the reason. If he dismisses it as noise/not relevant, use skip.`;
return [{ json: { prompt, thread_ts: j.thread_ts, text: j.text } }];
