const raw = $input.first().json.text || $input.first().json.output || '';
const items = $('Load Candidates').all().map(i => i.json).filter(s => s && s.id);
let cls = []; const m = raw.match(/\[[\s\S]*\]/); if (m) { try { cls = JSON.parse(m[0]); } catch (e) {} }
const byN = {}; cls.forEach(c => { byN[c.n] = c; });
return items.map((s, i) => {
  const c = byN[i + 1] || {};
  const verdict = c.verdict || 'do_later';
  const auto = !!c.auto_handle && (verdict === 'skip' || verdict === 'watch') && (c.confidence === 'high');
  return { json: { ...s, verdict, confidence: c.confidence || 'low', auto_handle: auto, hint: c.hint || '' } };
});
