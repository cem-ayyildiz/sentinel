// ===== Build Analyst Prompt — deep, multi-pass reasoning over all collected data =====
const d = $('Collect All Sources').first().json;
const ctx = $('Load Context').first().json || {};
const profile = ctx.profile || { always_skip: [], always_do: [], delegate_map: {} };
const recentDecisions = ctx.recent_decisions || [];

// ---- Number emails with stable tags so the model can reference them for archiving ----
const emailIndex = {};   // tag -> { account, id }
const renderEmails = (arr, prefix, account) => {
  if (!arr || !arr.length) return '_none_';
  return arr.map((e, i) => {
    const tag = `${prefix}${i + 1}`;
    emailIndex[tag] = { account, id: e.id };
    const flags = [
      e.unread ? 'unread' : 'read',
      e.starred ? '⭐starred' : '',
      e.important ? '❗important' : '',
      e.category !== 'primary' ? e.category : '',
      e.bulk ? 'bulk/newsletter' : '',
      e.automated ? 'automated/no-reply' : '',
    ].filter(Boolean).join(', ');
    return `[${tag}] *${e.subject}* — from ${e.from}\n     (${flags})\n     ${e.snippet}`;
  }).join('\n');
};
const emailsFsBlock = renderEmails(d.emailsFs, 'FS', 'fs');
const emailsGohmBlock = renderEmails(d.emailsGohm, 'GO', 'gohm');

const fmtEvents = (arr) => (arr && arr.length)
  ? arr.map(e => `- ${e.start.substring(0, 16).replace('T', ' ')} — *${e.summary}*${e.location ? ' @ ' + e.location : ''}${e.attendees ? ' | with: ' + e.attendees : ''}`).join('\n')
  : '_none_';

const fmtNotes = (arr) => (arr && arr.length)
  ? arr.map(n => `### ${n.title}\n${n.summary}`).join('\n\n')
  : '_no meeting notes since yesterday_';

const fmtSlack = (arr) => {
  if (!arr || !arr.length) return '_no channels read_';
  return arr.filter(c => c.count > 0).map(c =>
    `*#${c.channel}*${c.priv ? ' 🔒' : ''} (${c.count}):\n${c.messages.map(m => '  · ' + m).join('\n')}`
  ).join('\n\n') || '_all channels quiet_';
};

const fmtActivity = (org) => {
  const a = (d.clickupActivity || []).find(c => c.org === org);
  if (!a || !a.totalUpdated) return '_no task activity in last 48h_';
  return a.spaces.map(s => {
    const head = `▸ *${s.space}* — ${s.completed} done / ${s.active} in flight${s.topPeople.length ? ' · ' + s.topPeople.join(', ') : ''}`;
    const lines = s.tasks.map(t => `   ${t.done ? '✓' : '•'} ${t.name.substring(0, 60)} | ${t.status} | ${t.assignee}`).join('\n');
    return head + '\n' + lines;
  }).join('\n');
};

const cuOver = (org) => (d.clickupOverdue || []).find(c => c.org === org) || { count: 0, tasks: [] };
const fmtOverdue = (arr) => (arr && arr.length)
  ? arr.map(t => `- [${t.priority}] ${t.name.substring(0, 60)} | due ${t.due} | ${t.space}`).join('\n')
  : '_none_';
const oFs = cuOver('FreshSens'), oGohm = cuOver('GOHM'), oDiefi = cuOver('DIEFI');

// Flat FreshSens task list for the AI to bucket into functional teams.
const fsAll = ((d.clickupActivity || []).find(c => c.org === 'FreshSens') || {}).allTasks || [];
const fmtFsTasks = fsAll.length
  ? fsAll.map(t => `- ${t.done ? '✓' : '•'} ${t.name.substring(0, 72)} | ${t.status} | ${t.assignee}`).join('\n')
  : '_no FreshSens task activity in 48h_';

const fmtPersonal = (d.personal && d.personal.length)
  ? d.personal.map(t => `- ${t.name.substring(0, 72)} | ${t.status}${t.due ? ' | due ' + t.due : ''}${t.assignee !== 'unassigned' ? ' | ' + t.assignee : ''}`).join('\n')
  : '_none_';

const yesterday = (ctx.last_briefing && ctx.last_briefing.prose)
  ? ctx.last_briefing.prose
  : '_(no prior briefing yet — first run)_';

// Learning context: how Cem has decided before (grows as decisions are captured).
const profileStr = JSON.stringify(profile);
const decisionsStr = recentDecisions.length
  ? recentDecisions.slice(0, 60).map(r => `- [${r.verdict}] ${r.type}/${r.org || '?'}: ${r.title}${r.reason ? ' — ' + r.reason : ''}`).join('\n')
  : '_(no decisions captured yet — learning starts once Cem reacts to briefings)_';

const prompt = `You are Sentinel — chief-of-staff AI for Cem Ayyildiz: CTO of FreshSens (deep-tech agritech/post-harvest sensing startup), GM of GOHM (telecom/6G R&D), lead on DIEFI (EU research project). Today is ${d.todayDate}.

You are NOT a summarizer. You are an analyst. Read everything below, then REASON: correlate signals across sources, weigh what matters, track continuity from yesterday, and decide concrete actions. Be specific — real names, subjects, task titles, channel names.

ORG MAP — organize the briefing exactly around this structure:
• *FreshSens* (you are CTO) — NO active funded projects yet; *ZedCadit* funding is incoming. Report progress for each FUNCTIONAL TEAM separately: *Backend, Frontend, Machine Learning, Firmware, Hardware, Postharvest, Operations, Sales*. Bucket the FreshSens task list + Slack channels + daily-meeting notes into these teams. Slack→team: Backend=#fs-be, Frontend=#fs-fe, Postharvest=#fs-postharvest, Operations=#fs-operations/#operation-alerts/#work-orders/#deployments, Sales=#fs-sales/#web-contacts/#fs-seo. Firmware/Hardware/ML have no channel — infer from task names + #fs-alerts/#thingsboard_alarms + the FS-Firmware/FS-Software daily notes (e.g. "[Backend]"→backend; gateway/flash/OTA/sensor/firmware→firmware or hardware; battery forecast/trial-data-analysis/model/kiwi/migros-analysis→ML).
• *GOHM* (you are GM) — report by FUNDED PROJECT: *Robust6G* (ClickUp spaces ROBUST-6G + WP6), *DIEFI* (own ClickUp team), *6G-QTrust* = "Q-TRUST6G" (incoming — just got CELTIC conditional acceptance; track via email), plus any other incoming projects you see.
• *Personal / Smart Home* — Cem's Home list (Loxone Miniserver smart-home + house renovation).

╔═══════════ YESTERDAY'S BRIEFING (for continuity) ═══════════╗
${yesterday}
╚════════════════════════════════════════════════════════════╝

╔═══════════ HOW CEM DECIDES (learned profile + recent verdicts) ═══════════╗
Profile: ${profileStr}
Recent decisions:
${decisionsStr}
╚════════════════════════════════════════════════════════════╝
When an inbox email or task closely matches how Cem has decided before, pre-classify it: in Inbox Triage note "(likely <verdict> — matches past)". For high-confidence skips/archives that fit the profile's always_skip, fold them straight into Archive Suggestions without belaboring them.

═══════════ INBOX — FreshSens (ca@freshsens.ai) ═══════════
${emailsFsBlock}

═══════════ INBOX — GOHM (cem.ayyildiz@gohm.tech) ═══════════
${emailsGohmBlock}

═══════════ CALENDAR — FreshSens (yesterday → today) ═══════════
${fmtEvents(d.calFs)}

═══════════ CALENDAR — GOHM (yesterday → today) ═══════════
${fmtEvents(d.calGohm)}

═══════════ MEETING NOTES — Gemini summaries since yesterday ═══════════
${fmtNotes(d.meetingNotes)}

═══════════ SLACK — last 24h across ${d.slackChannelCount || '?'} channels (🔒 = private) ═══════════
${fmtSlack(d.slack)}

═══════════ FRESHSENS — all task activity last 48h (✓ shipped, • in flight) — BUCKET THESE INTO TEAMS ═══════════
${fmtFsTasks}

═══════════ GOHM + DIEFI — task activity by project space (✓ shipped, • in flight) ═══════════
— GOHM (Robust6G = ROBUST-6G/WP6 spaces) —
${fmtActivity('GOHM')}
— DIEFI —
${fmtActivity('DIEFI')}

═══════════ PERSONAL — Home / Smart-Home tasks (open) ═══════════
${fmtPersonal}

═══════════ OVERDUE — assigned to Cem ═══════════
FreshSens [${oFs.count}]:
${fmtOverdue(oFs.tasks)}
GOHM [${oGohm.count}]:
${fmtOverdue(oGohm.tasks)}
DIEFI [${oDiefi.count}]:
${fmtOverdue(oDiefi.tasks)}

${d.errors && d.errors.length ? '⚠️ Collection issues: ' + d.errors.join('; ') + '\n' : ''}
═══════════════════ PRODUCE THE BRIEFING ═══════════════════
Write in Slack markdown (*bold*, not **). Start DIRECTLY with the "🔁 Since Yesterday" section — do NOT add your own title, heading, or date line (a title is prepended automatically). Sections, in order:

*🔁 Since Yesterday* — compare to yesterday's briefing. What's STILL OPEN (and now older/riskier), what got RESOLVED, what's NEW today. 3–5 lines. If no prior briefing, say "First run — baseline established."

*📌 Today's Schedule* — each meeting tagged 🔴 must-attend / 🟡 optional / ⚪ routine (routine = internal daily/standup; must-attend = external/partner/customer, you present, decisions). Note prep; resolve time conflicts (say which wins).

*🔥 Top Priorities* (max 6) — ranked. Each: one action-oriented line, tagged [FS]/[GOHM]/[DIEFI]. CONNECT signals — e.g. an overdue task blocking a customer email, a meeting action that needs a task. Reference the email tag [FS3] when relevant.

*🚨 Issues & Incidents* — correlate the Slack alarms/errors/support signals into INCIDENTS, don't just echo them. For each: severity (🔴/🟠/🟡), what's happening, likely root-cause hypothesis if signals cluster (e.g. several backend 500s + sensors offline = same gateway?), suspected owner, and the next action. Cover #*-alerts, #thingsboard_alarms, #support, #produce_alarms, #operation-alerts, #deployments. If genuinely quiet, say so.

*🗣️ From Yesterday's Meetings* — from the Gemini notes, the decisions/action items that land on Cem or that he must chase. 1 line per meeting; skip routine standups unless notable.

*🏭 FreshSens — Team Progress* — report EACH team on its own line: *Backend · Frontend · Machine Learning · Firmware · Hardware · Postharvest · Operations · Sales*. Per team: what shipped (✓) / in flight / blockers / who's driving — bucket the FreshSens task list + team Slack channels + daily notes. Flag single-person bottlenecks or stalls. A team with no signal gets one word ("quiet"). End with one line: no funded projects yet — ZedCadit incoming.

*🛰️ GOHM — Projects* — report by funded project: *Robust6G* (incl. WP6), *DIEFI*, *6G-QTrust* (incoming). Per project: status, what moved, key deadline (e.g. D1.4), what needs Cem. Note any other incoming project.

*🏠 Personal / Smart Home* — from the Home list: 2–4 lines on what's open (Loxone/smart-home issues + house items), flag anything time-sensitive or that you've been carrying a while.

*📨 Inbox Triage* — you have ${(d.emailsFs||[]).length + (d.emailsGohm||[]).length} inbox emails above. Give: (a) *Reply needed* (max 6) — emails that genuinely need Cem; name sender + the ask + reference [tag]. (b) *Delegate* — who should own it. (c) *Archive (FYI)* — count + the tags you judge safe to archive (automated/bulk/no-reply/receipts/newsletters/promotions/spam digests). NEVER archive: starred/important, anything from a real person, anything needing a reply, OR security/login/account notices (new-device login, password reset, verification codes, payment failures) — those stay in inbox. List the safe tags.

*✅ Quick Wins* (1–3) — closable in <15 min.

Rules: direct, no filler, no restating raw data. Keep each team/project line tight (1–2 lines). Separate the orgs. Hard cap 1100 words for the prose.

After the prose, on a new line, output EXACTLY one fenced JSON block with the machine-actionable decisions (this drives auto-archiving and tomorrow's continuity):
\`\`\`json
{"archive_tags": ["FS3","GO5"], "open_issues": ["one-line each: the issues/items that must carry to tomorrow"]}
\`\`\`
Only include email tags in archive_tags that are genuinely safe FYI to remove from inbox (NEVER security/login/account notices). Be conservative.`;

return [{ json: { prompt, todayDate: d.todayDate, emailIndex } }];
