// Build a Fibonacci story-point estimation prompt from the task title + description.
const CK = '__CLICKUP_API_KEY__';
const J = (r) => typeof r === 'string' ? JSON.parse(r) : r;
const out = [];
for (const it of $input.all()) {
  const tid = it.json.task_id; let desc='';
  try { const t = J(await this.helpers.httpRequest({ method:'GET', url:`https://api.clickup.com/api/v2/task/${tid}?include_markdown_description=true`, headers:{ Authorization: CK } }));
        desc = String(t.markdown_description||t.text_content||t.description||'').slice(0,1500); } catch(e) {}
  const prompt = `Estimate the story points for this software-engineering task using the Fibonacci scale (1, 2, 3, 5, 8, 13). Judge purely by scope and complexity. Reply with ONLY the integer — no words.\n\nTitle: ${it.json.task_name||''}\nDescription: ${desc||'(none)'}`;
  out.push({ json: { task_id: tid, task_name: it.json.task_name||null, org: it.json.org||'freshsens', prompt } });
}
return out;
