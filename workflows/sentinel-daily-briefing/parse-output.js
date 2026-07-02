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

// Slack mrkdwn uses *single* asterisks; the model occasionally slips into **markdown bold**.
prose = prose.replace(/\*\*(.+?)\*\*/g, '*$1*');

// Auto-archiving retired — Cem curates his own inbox now, so Sentinel never archives mail.
const archive = [];

// Normalize open_issues into the structured ledger shape. Tolerates legacy plain strings and
// missing fields; first_seen defaults to today so ages stay computable from day one.
const todayDate = $('Build Analyst Prompt').first().json.todayDate;
const ORGS = ['fs', 'gohm', 'diefi', 'personal'];
const openIssues = (Array.isArray(actions.open_issues) ? actions.open_issues : []).map(it => {
  if (typeof it === 'string') return { title: it.substring(0, 200), org: null, severity: null, owner: null, next_action: null, first_seen: todayDate };
  if (!it || typeof it !== 'object' || !it.title) return null;
  return {
    title: String(it.title).substring(0, 200),
    org: ORGS.includes(String(it.org || '').toLowerCase()) ? String(it.org).toLowerCase() : null,
    severity: ['high', 'med', 'low'].includes(String(it.severity || '').toLowerCase()) ? String(it.severity).toLowerCase() : null,
    owner: it.owner ? String(it.owner).substring(0, 60) : null,
    next_action: it.next_action ? String(it.next_action).substring(0, 200) : null,
    first_seen: /^\d{4}-\d{2}-\d{2}$/.test(String(it.first_seen || '')) ? it.first_seen : todayDate,
  };
}).filter(Boolean).slice(0, 20);

return [{ json: {
  briefing: prose,
  archive,
  openIssues,
  todayDate,
} }];
