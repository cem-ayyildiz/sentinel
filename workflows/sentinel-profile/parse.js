// Extract the JSON profile from Claude's output.
const raw = $input.first().json.text || $input.first().json.output || '';
let profile = { always_skip: [], always_do: [], delegate_map: {} };
const m = raw.match(/\{[\s\S]*\}/);
if (m) { try { profile = JSON.parse(m[0]); } catch (e) {} }
return [{ json: { profile } }];
