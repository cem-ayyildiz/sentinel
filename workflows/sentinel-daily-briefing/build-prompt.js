// ===== Build Analyst Prompt — deep reasoning over all collected data =====
// ClickUp is now registry-tiered: Development (deep) + Management daily, GOHM/DIEFI daily,
// Sales/Team-Leads/Fundraising weekly (Fridays) with critical items escalated any day.
const d = $('Collect All Sources').first().json;
const ctx = $('Load Context').first().json || {};
const profile = ctx.profile || { always_skip: [], always_do: [], delegate_map: {} };
const recentDecisions = ctx.recent_decisions || [];
const cu = d.clickup || { daily: [], weekly: [], escalations: [], personal: [] };
const isFriday = !!cu.isFriday;

// ---- Number emails with stable tags so the model can reference them for archiving ----
const emailIndex = {};
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

// ---- ClickUp renderers over the new registry-tiered structure ----
const fmtStatus = (t) => Object.entries(t || {}).map(([s, n]) => `${s}:${n}`).join(' · ');
const fmtPeople = (people, withSP) => Object.entries(people || {})
  .sort((a, b) => (b[1].done + b[1].active) - (a[1].done + a[1].active)).slice(0, 8)
  .map(([u, v]) => `${u} ${v.done}✓/${v.active}•${withSP && (v.doneSP || v.remSP) ? ` ${v.doneSP || 0}/${(v.doneSP || 0) + (v.remSP || 0)}SP` : ''}`)
  .join(' · ');
const space = (org, name) => (cu.daily || []).find(s => s.org === org && s.name === name)
  || (cu.weekly || []).find(s => s.org === org && s.name === name);

const fmtDev = (s) => {
  if (!s) return '_no Development sprint data_';
  if (s.error) return `_Development: ${s.error}_`;
  const hyg = (s.hygiene || []).map(h => {
    if (h.flag === 'stale_in_progress') return `${h.n} stale in-progress (no update >3d): ${(h.sample || []).join('; ')}`;
    if (h.flag === 'missing_points') return `${h.n}/${h.of} active tasks have NO story points`;
    if (h.flag === 'nothing_in_review') return `nothing currently in Review`;
    if (h.flag === 'in_progress_no_comment') return `${h.n} in-progress with no recent comment`;
    return h.flag;
  });
  return `*${s.sprint}* — ${s.total} tasks · ${fmtStatus(s.statusTotals)}\n`
    + `   People (✓done/•active/SP): ${fmtPeople(s.people, true)}\n`
    + (hyg.length ? `   ⚠️ BOARD HYGIENE: ${hyg.join(' | ')}\n` : '')
    + `   Tasks:\n` + (s.tasks || []).slice(0, 26).map(t => `     ${t.done ? '✓' : '•'} ${t.name} | ${t.status} | ${t.assignee}${t.points != null ? ` (${t.points}sp)` : ''}`).join('\n');
};
const fmtTrack = (s, label) => {
  if (!s) return `_${label}: no activity in last 7d_`;
  return `*${label}* — ${s.active} in flight / ${s.completed} done (7d, ${s.movedLast7d} moved)`
    + (Object.keys(s.people || {}).length ? `\n   ${fmtPeople(s.people)}` : '')
    + `\n` + (s.tasks || []).slice(0, 10).map(t => `     ${t.done ? '✓' : '•'} ${t.name} | ${t.status} | ${t.assignee}`).join('\n');
};
const fmtComments = (org) => {
  const cs = (ctx.dev_comments || []).filter(c => !org || c.org === org);
  if (!cs.length) return '_no new task comments in last 24h_';
  return cs.slice(0, 20).map(c => `   💬 *${(c.task_name || 'task').substring(0, 50)}* — ${c.commenter}${c.is_agent ? ' 🤖' : ''}: ${(c.text || '').replace(/\s+/g, ' ').substring(0, 150)}`).join('\n');
};
const fmtEsc = () => {
  const e = cu.escalations || [];
  if (!e.length) return '_none_';
  return e.map(x => `- [${x.why}] *${x.name}* (${x.org}/${x.space}) — ${x.status}${x.due ? `, due ${x.due}` : ''}, ${x.assignee}`).join('\n');
};
const fmtWeekly = () => {
  const sp = (ctx.weekly_sp || []).filter(r => r.person);
  const agent = ctx.weekly_agent || {};
  const wk = cu.weekly || [];
  const out = [];
  out.push(sp.length
    ? '*Completed this week (entered Review/Closed · SP):*\n' + sp.map(r => `   • ${r.person}: ${r.tasks_done} tasks · ${r.sp || 0} SP`).join('\n')
    : '_no per-person weekly story points captured yet (ledger builds forward from 2026-06-26)_');
  if (agent.deliveries) out.push(`*Multica Agent:* ${agent.deliveries} MR deliveries · ${agent.sp || 0} SP`);
  if (wk.length) out.push('*Weekly-cadence spaces:*\n' + wk.map(s => `   ▸ ${s.org}/${s.name}: ${s.active} open / ${s.completed} done (7d)`).join('\n'));
  return out.join('\n');
};
const fmtPersonal = (cu.personal && cu.personal.length)
  ? cu.personal.map(t => `- ${(t.name || '').substring(0, 72)} | ${t.status}${t.due ? ' | due ' + new Date(t.due).toLocaleDateString('en-GB') : ''}${t.assignee && t.assignee !== 'unassigned' ? ' | ' + t.assignee : ''}`).join('\n')
  : '_none_';

const cuOver = (org) => (d.clickupOverdue || []).find(c => c.org === org) || { count: 0, tasks: [] };
const fmtOverdue = (arr) => (arr && arr.length)
  ? arr.map(t => `- [${t.priority}] ${(t.name || '').substring(0, 60)} | due ${t.due}`).join('\n')
  : '_none_';
const oFs = cuOver('FreshSens'), oGohm = cuOver('GOHM'), oDiefi = cuOver('DIEFI');

const yesterday = (ctx.last_briefing && ctx.last_briefing.prose) ? ctx.last_briefing.prose : '_(no prior briefing yet — first run)_';
const profileStr = JSON.stringify(profile);
const decisionsStr = recentDecisions.length
  ? recentDecisions.slice(0, 60).map(r => `- [${r.verdict}] ${r.type}/${r.org || '?'}: ${r.title}${r.reason ? ' — ' + r.reason : ''}`).join('\n')
  : '_(no decisions captured yet — learning starts once Cem reacts to briefings)_';

const prompt = `You are Sentinel — chief-of-staff AI for Cem Ayyildiz: CTO of FreshSens (deep-tech agritech/post-harvest sensing startup), GM of GOHM (telecom/6G R&D), lead on DIEFI (EU research project). Today is ${d.todayDate} (${cu.weekdayName || ''}).

You are NOT a summarizer. You are an analyst. Read everything below, then REASON: correlate signals across sources, weigh what matters, track continuity from yesterday, and decide concrete actions. Be specific — real names, subjects, task titles, channel names.

ORG MAP — organize the briefing around Cem's real ClickUp workspace structure:
• *FreshSens* (CTO) — reported by SPACE on a cadence:
   - *Development* (DAILY, deep) — where the ML / Hardware / Firmware / Backend / Software teams work, on a sprint board. Report who's on what, real progress, NEW task comments, blockers. "Review" status counts as DONE/near-done. Within Development, group by team where inferable from assignee + task name (e.g. gateway/flash/OTA/sensor→firmware/hardware; model/forecast/analysis→ML; [Backend]/api→backend).
   - *Management* (DAILY, track) — Baran & Cem's high-level planning. Track what moved.
   - *Sales / Marketing / PH & Ops*, *Team Leads*, *Fundraising* (WEEKLY — full summary only on FRIDAY; today isFriday=${isFriday}). On other days they appear ONLY as escalations below.
• *GOHM* (GM) — DAILY: *Management* space is the live hub (holds the sprint folder; Robust6G coordination + incoming Q-TRUST6G land here).
• *DIEFI* (EU project of GOHM) — DAILY: its Development space; Cem leads it, deliverable deadlines matter.
• *Personal / Smart Home* — GOHM "Home" space (Loxone + house).

╔═══════════ YESTERDAY'S BRIEFING (for continuity) ═══════════╗
${yesterday}
╚════════════════════════════════════════════════════════════╝

╔═══════════ HOW CEM DECIDES (learned profile + recent verdicts) ═══════════╗
Profile: ${profileStr}
Recent decisions:
${decisionsStr}
╚════════════════════════════════════════════════════════════╝
When an inbox email or task closely matches how Cem has decided before, pre-classify it: in Inbox Triage note "(likely <verdict> — matches past)". Fold high-confidence always_skip items straight into Archive Suggestions.

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

═══════════ FRESHSENS · DEVELOPMENT (daily — active sprint, Review=done) ═══════════
${fmtDev(space('freshsens', 'Development'))}

— NEW Development task comments (last 24h; 🤖 = Multica agent / integration) —
${fmtComments('freshsens')}

═══════════ FRESHSENS · MANAGEMENT (daily) ═══════════
${fmtTrack(space('freshsens', 'Management'), 'Management')}

═══════════ GOHM + DIEFI (daily) ═══════════
${fmtTrack(space('gohm', 'Management'), 'GOHM / Management')}
${fmtTrack(space('diefi', 'Development'), 'DIEFI / Development')}

═══════════ ⚡ ESCALATIONS — critical items from weekly-cadence spaces (Sales / Team Leads / Fundraising / Admin) ═══════════
${fmtEsc()}

${isFriday ? `═══════════ 📊 WEEKLY REVIEW (Friday) ═══════════\n${fmtWeekly()}\n` : ''}
═══════════ PERSONAL — Home / Smart-Home (open) ═══════════
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
Write in Slack markdown (*bold*, not **). Start DIRECTLY with the "🔁 Since Yesterday" section — no title/date line (one is prepended automatically). Sections, in order:

*🔁 Since Yesterday* — vs yesterday's briefing: what's STILL OPEN (now older/riskier), RESOLVED, NEW. 3–5 lines. If no prior briefing, "First run — baseline established."

*📌 Today's Schedule* — each meeting tagged 🔴 must-attend / 🟡 optional / ⚪ routine; note prep; resolve conflicts.

*🔥 Top Priorities* (max 6) — ranked, tagged [FS]/[GOHM]/[DIEFI]. CONNECT signals (an overdue task blocking a customer email; a meeting action needing a task). PULL IN any ⚡ escalations above. Reference email tags like [FS3].

*🚨 Issues & Incidents* — correlate Slack alarms/errors/support into INCIDENTS (severity, root-cause hypothesis, owner, next action). Cover #*-alerts, #thingsboard_alarms, #support, #produce_alarms, #operation-alerts, #deployments. If quiet, say so.

*🗣️ From Yesterday's Meetings* — decisions/action items landing on Cem. 1 line/meeting; skip routine standups unless notable.

*🏭 FreshSens — Development* — the heart of the daily. Per dev team (ML · Hardware · Firmware · Backend · Software) where inferable: what shipped (✓) / in flight / blockers / who's driving. Weave in the NEW task comments (real progress/decisions). THEN a *Board hygiene* line: surface the ⚠️ flags above (stale in-progress, missing story points, nothing in review) as a gentle nudge — the team doesn't always keep the board honest. Then one line on *Management* (what Baran/Cem moved).

*🛰️ GOHM & DIEFI* — GOHM/Management (Robust6G + Q-TRUST6G) and DIEFI: status, what moved, key deadline, what needs Cem.

${isFriday ? '*📊 Weekly Review* — completed issues + story points PER PERSON this week (from the weekly data above), the Multica Agent\'s deliveries, and a short summary of Sales / Team Leads / Fundraising. Mirror Cem\'s sheet people: Gabby, Sevval, Sina Can, Sultan, Muhammad, Multica Agent.\n' : ''}*🏠 Personal / Smart Home* — 2–4 lines on open Home items; flag anything time-sensitive.

*📨 Inbox Triage* — ${(d.emailsFs || []).length + (d.emailsGohm || []).length} inbox emails above. (a) *Reply needed* (max 6) — name sender + ask + [tag]. (b) *Delegate* — who owns it. (c) *Archive (FYI)* — count + safe tags (automated/bulk/no-reply/receipts/newsletters/promotions). NEVER archive: starred/important, real-person mail, anything needing a reply, or security/login/account notices.

*✅ Quick Wins* (1–3) — closable in <15 min.

Rules: direct, no filler, no restating raw data. Tight lines (1–2 each). Separate the orgs. Slack mrkdwn STRICT: *single asterisks* for bold (never **), no markdown tables, no "|" pipes — use "• Label — value" bullets. Hard cap 1100 words.

After the prose, on a new line, output EXACTLY one fenced JSON block:
\`\`\`json
{"archive_tags": ["FS3","GO5"], "open_issues": ["one-line each: items that must carry to tomorrow"]}
\`\`\`
Only genuinely-safe FYI tags in archive_tags (NEVER security/login/account). Be conservative.`;

return [{ json: { prompt, todayDate: d.todayDate, emailIndex } }];
