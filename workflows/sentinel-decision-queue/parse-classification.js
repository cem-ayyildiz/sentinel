const raw = $input.first().json.text || $input.first().json.output || '';
const items = $('Load Candidates').all().map(i => i.json).filter(s => s && s.id);
let cls = [];
const m = raw.match(/\[[\s\S]*\]/);
if (m) { try { cls = JSON.parse(m[0]); } catch (e) {} }
const byN = {}; cls.forEach(c => { byN[c.n] = c; });
return items.map((s, i) => {
  const c = byN[i + 1] || {};
  return { json: { ...s, auto_skip: !!c.auto_skip, hint: c.hint || '' } };
});
