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

// Deterministic no-duplication guard: the model sometimes repeats a YOUR DAY task inside
// ⏳ Overdue (occasionally with a contradictory verdict). Drop any Overdue bullet whose
// task id already appeared earlier in the prose — the earlier (higher-precedence) mention wins.
{
  const seen = new Set();
  let inOverdue = false;
  prose = prose.split('\n').filter(line => {
    if (line.startsWith('*') || /^─{4,}/.test(line)) inOverdue = /⏳/.test(line);
    const ids = [...line.matchAll(/app\.clickup\.com\/t\/(\w+)/g)].map(m => m[1]);
    if (inOverdue && ids.some(id => seen.has(id))) return false;
    ids.forEach(id => seen.add(id));
    return true;
  }).join('\n');
}

// ---- Deterministic 📌 Schedule (code-rendered from the calendars; the model no longer writes it).
// Routine dailies/standups are skipped per Cem; 🔴 = external attendees present, 🟡 = internal.
try {
  const col = $('Collect All Sources').first().json;
  const today = $('Build Analyst Prompt').first().json.todayDate;
  const ROUTINE_RE = /daily|stand-?up/i;
  const INTERNAL_RE = /@(freshsens\.ai|gohm\.tech|gohm\.com\.tr)$/i;
  const seenEv = new Set();
  const evs = [];
  for (const [arr, org] of [[col.calFs, 'FS'], [col.calGohm, 'GOHM']]) {
    for (const e of (arr || [])) {
      const start = e.start || '';
      if (start.substring(0, 10) !== today) continue;
      if (ROUTINE_RE.test(e.summary || '')) continue;
      const key = start.substring(0, 16) + '|' + (e.summary || '').toLowerCase().trim();
      if (seenEv.has(key)) continue;
      seenEv.add(key);
      const attendees = (e.attendees || '').split(',').map(x => x.trim()).filter(Boolean);
      evs.push({
        time: start.length > 10 ? start.substring(11, 16) : 'all-day',
        org, name: e.summary,
        external: attendees.some(a => !INTERNAL_RE.test(a)),
      });
    }
  }
  evs.sort((a, b) => a.time.localeCompare(b.time));
  const sched = "*📌 Today's Schedule*\n" + (evs.length
    ? evs.map(e => `• ${e.time} ${e.external ? '🔴' : '🟡'} [${e.org}] ${e.name}`).join('\n')
    : '_no non-routine meetings today_');
  let at = prose.indexOf('\n*⏳');
  if (at < 0) { const m = prose.match(/\n─{4,}/); at = m ? m.index : prose.length; }
  prose = prose.slice(0, at) + '\n\n' + sched + prose.slice(at);
} catch (e) { /* schedule is additive — never break the briefing */ }

// Auto-archiving retired — Cem curates his own inbox now, so Sentinel never archives mail.
const archive = [];

// Normalize open_issues into the structured ledger shape. Tolerates legacy plain strings and
// missing fields; first_seen defaults to today so ages stay computable from day one.
const todayDate = $('Build Analyst Prompt').first().json.todayDate;
const ORGS = ['fs', 'gohm', 'diefi', 'personal'];
// Canonicalize sources: the model writes email tags ("email:FS2"); convert to the permanent
// account+message-id form the collector can re-verify tomorrow (auto-resolution).
const canonSource = (src) => {
  if (!src) return null;
  let s = String(src).trim();
  const tag = s.match(/^email:([A-Z]{2,3}\d+)\b/i);
  if (tag) {
    const ref = emailIndex[tag[1].toUpperCase()];
    if (ref) s = `email:${ref.account}:${ref.id}`;
  }
  return s.substring(0, 90);
};
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
    source: canonSource(it.source),
  };
}).filter(Boolean).slice(0, 20);

return [{ json: {
  briefing: prose,
  archive,
  openIssues,
  todayDate,
} }];
