// ===== Parse Analyst Output — split prose briefing from the JSON ACTIONS block =====
const raw = $input.first().json.text || $input.first().json.output || '';
const emailIndex = $('Build Analyst Prompt').first().json.emailIndex || {};

let actions = { archive_tags: [], open_issues: [] };
let prose = raw;

// Extract the fenced ```json ... ``` block (prefer the last one).
const matches = [...raw.matchAll(/```json\s*([\s\S]*?)```/gi)];
if (matches.length) {
  const block = matches[matches.length - 1];
  try {
    actions = JSON.parse(block[1].trim());
  } catch (e) {
    // tolerate minor issues: grab the first {...}
    try { actions = JSON.parse((block[1].match(/\{[\s\S]*\}/) || ['{}'])[0]); } catch (e2) {}
  }
  prose = raw.replace(block[0], '').trim();
} else {
  // fallback: a bare {...} with archive_tags near the end
  const m = raw.match(/\{[\s\S]*"archive_tags"[\s\S]*\}/);
  if (m) { try { actions = JSON.parse(m[0]); prose = raw.replace(m[0], '').trim(); } catch (e) {} }
}

// Map archive tags -> real {account, id}, dropping anything unknown (no hallucinated ids).
const archive = (actions.archive_tags || [])
  .map(t => ({ tag: t, ...(emailIndex[t] || {}) }))
  .filter(x => x.id && x.account);

return [{ json: {
  briefing: prose,
  archive,
  openIssues: actions.open_issues || [],
  todayDate: $('Build Analyst Prompt').first().json.todayDate,
} }];
