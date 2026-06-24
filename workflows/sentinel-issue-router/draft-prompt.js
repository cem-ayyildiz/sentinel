const items = $input.all().map(i => i.json).filter(s => s && s.id);
const lines = items.map((s, i) =>
  `${i + 1}. [${s.verdict}] ${s.org} | "${s.title}" from ${(s.actor || '?').replace(/<.*>/, '').trim()} — ${(s.body || '').substring(0, 140)}${s.reason ? `  (Cem's note: ${s.reason})` : ''}`
).join('\n');
const prompt = `You turn Cem's triage decisions into concrete ClickUp tasks for his approval. For each item draft a clear, actionable task.

Items (the verdict shows what Cem decided — delegate_person = a teammate owns it; do_later = Cem, not today):
${lines || '(none)'}

For each, return: a crisp imperative "title" (<=80 chars), a 1-2 sentence "description" (what to do + why), an "assignee_hint" (who should own it — infer from context / Cem's note, e.g. "Baran"; use "Cem" for do_later), and a "due_hint" ("today" | "this week" | "none").

Return ONLY a JSON array in the SAME order: [{"n":1,"title":"...","description":"...","assignee_hint":"...","due_hint":"..."}]`;
return [{ json: { prompt } }];
