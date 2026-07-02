// ===== Build Analyst Prompt — deep reasoning over all collected data =====
// v3 (2026-07-02): stateful OPEN ISSUE LEDGER (ages computed in code, not by the LLM),
// YOUR DAY personal action block, overdue-debt triage, 2026 roadmap alignment, and
// clickable Slack links on every actionable item.
const d = $('Collect All Sources').first().json;
const ctx = $('Load Context').first().json || {};
const profile = ctx.profile || { always_skip: [], always_do: [], delegate_map: {} };
const recentDecisions = ctx.recent_decisions || [];
const cu = d.clickup || { daily: [], weekly: [], escalations: [], personal: [] };
const isFriday = !!cu.isFriday;

// ---- Slack-link helpers: the model must be able to COPY real links, never invent them ----
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '/');
const link = (url, text) => url ? `<${url}|${esc(text)}>` : esc(text);
const gmailUrl = (account, id) =>
  `https://mail.google.com/mail/?authuser=${account === 'fs' ? 'ca@freshsens.ai' : 'cem.ayyildiz@gohm.tech'}#all/${id}`;

// ---- Number emails with stable tags so the model can reference them without hallucinating ids ----
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
    return `[${tag}] ${link(gmailUrl(account, e.id), e.subject)} — from ${esc(e.from)}\n     (${flags})\n     ${e.snippet}`;
  }).join('\n');
};
// Inbox = Cem's curated focus; the "net" items arrived recently but he already moved them OUT of
// the inbox — shown only because they look urgent (safety net). Render them separately.
const fsFocus = (d.emailsFs || []).filter(e => !e.outsideInbox);
const fsNet   = (d.emailsFs || []).filter(e => e.outsideInbox);
const goFocus = (d.emailsGohm || []).filter(e => !e.outsideInbox);
const goNet   = (d.emailsGohm || []).filter(e => e.outsideInbox);
const emailsFsBlock = renderEmails(fsFocus, 'FS', 'fs');
const emailsGohmBlock = renderEmails(goFocus, 'GO', 'gohm');
const netFsBlock = renderEmails(fsNet, 'FSX', 'fs');
const netGohmBlock = renderEmails(goNet, 'GOX', 'gohm');
// Cem's recent DM messages — top-level AND thread replies (his stated daily focus lives here).
const cemChat = d.cemChat || [];
const cemChatBlock = cemChat.length
  ? cemChat.map(m => `- [${m.when || ''}] ${m.text}`).join('\n')
  : '_none in the last 3 days_';

// ---- OPEN ISSUE LEDGER — yesterday's structured open_issues, ages computed HERE (authoritative) ----
const ledgerArr = (ctx.last_briefing && Array.isArray(ctx.last_briefing.open_issues)) ? ctx.last_briefing.open_issues : [];
const ageOf = (fs) => { const t = Date.parse(fs); return isNaN(t) ? null : Math.max(0, Math.round((Date.parse(d.todayDate) - t) / 86400000)); };
const ledgerBlock = ledgerArr.length ? ledgerArr.map(it => {
  if (typeof it === 'string') return `- ${it} (age unknown — legacy entry; assign first_seen when you carry it)`;
  const a = ageOf(it.first_seen);
  return `- [${(it.org || '?').toUpperCase()}]${a != null ? ` *day ${a + 1}*` : ''}${it.severity ? ` (${it.severity})` : ''} ${it.title}`
    + `${it.owner ? ` — owner: ${it.owner}` : ''}${it.next_action ? ` — next: ${it.next_action}` : ''}`
    + ` (first_seen ${it.first_seen || '?'})`;
}).join('\n') : '_(ledger empty — first structured run; seed it from today\'s data)_';

// ---- 2026 strategic goals (Miro roadmap, loaded by Load Context) ----
const roadmapBlock = (ctx.roadmap && String(ctx.roadmap).trim())
  ? String(ctx.roadmap).trim().substring(0, 3000)
  : '_(roadmap not loaded)_';

const fmtEvents = (arr) => (arr && arr.length)
  ? arr.map(e => `- ${e.start.substring(0, 16).replace('T', ' ')} — *${e.summary}*${e.location ? ' @ ' + e.location : ''}${e.attendees ? ' | with: ' + e.attendees : ''}`).join('\n')
  : '_none_';

const fmtNotes = (arr) => (arr && arr.length)
  ? arr.map(n => `### ${n.title}\n${n.summary}`).join('\n\n')
  : '_no meeting notes since yesterday_';

const fmtSlack = (arr) => {
  if (!arr || !arr.length) return '_no channels read_';
  return arr.filter(c => c.count > 0).map(c =>
    `*#${c.channel}*${c.priv ? ' 🔒' : ''}${c.org ? ' [' + c.org + ']' : ''}${c.escalated ? ' ⚡weekly-escalated' : ''} (${c.count}):\n${c.messages.map(m => '  · ' + m).join('\n')}`
  ).join('\n\n') || '_all channels quiet_';
};

// ---- ClickUp renderers over the registry-tiered structure (now with links) ----
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
    + `   Tasks:\n` + (s.tasks || []).slice(0, 26).map(t => `     ${t.done ? '✓' : '•'} ${link(t.url, t.name)} | ${t.status} | ${t.assignee}${t.points != null ? ` (${t.points}sp)` : ''}`).join('\n');
};
const fmtTrack = (s, label) => {
  if (!s) return `_${label}: no activity in last 7d_`;
  return `*${label}* — ${s.active} in flight / ${s.completed} done (7d, ${s.movedLast7d} moved)`
    + (Object.keys(s.people || {}).length ? `\n   ${fmtPeople(s.people)}` : '')
    + `\n` + (s.tasks || []).slice(0, 10).map(t => `     ${t.done ? '✓' : '•'} ${link(t.url, t.name)} | ${t.status} | ${t.assignee}`).join('\n');
};
const fmtComments = (org) => {
  const cs = (ctx.dev_comments || []).filter(c => !org || c.org === org);
  if (!cs.length) return '_no new task comments in last 24h_';
  return cs.slice(0, 20).map(c => `   💬 *${(c.task_name || 'task').substring(0, 50)}* — ${c.commenter}${c.is_agent ? ' 🤖' : ''}: ${(c.text || '').replace(/\s+/g, ' ').substring(0, 150)}`).join('\n');
};
const fmtEsc = () => {
  const e = cu.escalations || [];
  if (!e.length) return '_none_';
  return e.map(x => `- [${x.why}] ${link(x.url, x.name)} (${x.org}/${x.space}) — ${x.status}${x.due ? `, due ${x.due}` : ''}, ${x.assignee}`).join('\n');
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
  ? cu.personal.map(t => `- ${link(t.url, (t.name || '').substring(0, 72))} | ${t.status}${t.due ? ' | due ' + new Date(t.due).toLocaleDateString('en-GB') : ''}${t.assignee && t.assignee !== 'unassigned' ? ' | ' + t.assignee : ''}`).join('\n')
  : '_none_';

const cuOver = (org) => (d.clickupOverdue || []).find(c => c.org === org) || { count: 0, tasks: [] };
const fmtOverdue = (arr) => (arr && arr.length)
  ? arr.map(t => `- [${t.priority}] ${link(t.url, (t.name || '').substring(0, 60))} | ${t.status} | due ${t.due}`).join('\n')
  : '_none_';
const oFs = cuOver('FreshSens'), oGohm = cuOver('GOHM'), oDiefi = cuOver('DIEFI');
const overdueTotal = (oFs.count || 0) + (oGohm.count || 0) + (oDiefi.count || 0);

const profileStr = JSON.stringify(profile);
const decisionsStr = recentDecisions.length
  ? recentDecisions.slice(0, 60).map(r => `- [${r.verdict}] ${r.type}/${r.org || '?'}: ${r.title}${r.reason ? ' — ' + r.reason : ''}`).join('\n')
  : '_(no decisions captured yet — learning starts once Cem reacts to briefings)_';

const prompt = `You are Sentinel — chief-of-staff AI for Cem Ayyildiz: CTO of FreshSens (deep-tech agritech/post-harvest sensing startup), GM of GOHM (telecom/6G R&D), lead on DIEFI (EU research project). Today is ${d.todayDate} (${cu.weekdayName || ''}).

You are NOT a summarizer. You are an analyst. Read everything below, then REASON: correlate signals across sources, weigh what matters, track continuity via the OPEN ISSUE LEDGER, and decide concrete actions. Be specific — real names, subjects, task titles, channel names.

LINK RULE (mandatory): items in the data below carry real Slack links in the form <url|text>. When you reference a task or email in 🎯 YOUR DAY, 🔥 Top Priorities, ⏳ Overdue or ✅ Quick Wins, COPY its link exactly as given so Cem can click straight through. NEVER invent or alter a URL; if an item has no link, plain text is fine.

ORG MAP — organize the briefing around Cem's real ClickUp workspace structure:
• *FreshSens* (CTO) — reported by SPACE on a cadence:
   - *Development* (DAILY, deep) — where the ML / Hardware / Firmware / Backend / Software teams work, on a sprint board. Report who's on what, real progress, NEW task comments, blockers. "Review" status counts as DONE/near-done. Within Development, group by team where inferable from assignee + task name (e.g. gateway/flash/OTA/sensor→firmware/hardware; model/forecast/analysis→ML; [Backend]/api→backend).
   - *Management* (DAILY, track) — Baran & Cem's high-level planning. Track what moved.
   - *Sales / Marketing / PH & Ops*, *Team Leads*, *Fundraising* (WEEKLY — full summary only on FRIDAY; today isFriday=${isFriday}). On other days they appear ONLY as escalations below.
• *GOHM* (GM) — DAILY: *Management* space is the live hub (holds the sprint folder; Robust6G coordination + incoming Q-TRUST6G land here).
• *DIEFI* (EU project of GOHM) — DAILY: its Development space; Cem leads it, deliverable deadlines matter.
• *Personal / Smart Home* — GOHM "Home" space (Loxone + house).

╔═══════════ 2026 STRATEGIC GOALS (Miro roadmap — rank priorities AGAINST these) ═══════════╗
${roadmapBlock}
╚════════════════════════════════════════════════════════════╝

╔═══════════ OPEN ISSUE LEDGER (authoritative day-counts, computed from stored state — do NOT re-derive ages yourself) ═══════════╗
${ledgerBlock}
╚════════════════════════════════════════════════════════════╝

╔═══════════ HOW CEM DECIDES (learned profile + recent verdicts) ═══════════╗
Profile: ${profileStr}
Recent decisions:
${decisionsStr}
╚════════════════════════════════════════════════════════════╝
When an inbox email or task closely matches how Cem has decided before, pre-classify it: in Inbox Triage note "(likely <verdict> — matches past)". Cem now curates his own inbox — do NOT propose archiving anything; just triage what he chose to keep in the inbox.

═══════════ 🎯 CEM'S RECENT MESSAGES TO YOU (DM + briefing-thread replies, last 3 days — his stated focus/priorities OVERRIDE your ranking) ═══════════
${cemChatBlock}

═══════════ INBOX — FreshSens (ca@freshsens.ai) — Cem's curated focus ═══════════
${emailsFsBlock}

═══════════ INBOX — GOHM (cem.ayyildiz@gohm.tech) — Cem's curated focus ═══════════
${emailsGohmBlock}

═══════════ ⚠️ SAFETY NET — arrived in the last 2 days but NOT in the inbox (Cem already archived/sorted them); shown ONLY because they look urgent ═══════════
FreshSens:
${netFsBlock}
GOHM:
${netGohmBlock}

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
═══════════ PERSONAL — Home / Smart-Home (all open) ═══════════
${fmtPersonal}

═══════════ ⏳ OVERDUE — assigned to Cem (${overdueTotal} total) ═══════════
FreshSens [${oFs.count}]:
${fmtOverdue(oFs.tasks)}
GOHM [${oGohm.count}]:
${fmtOverdue(oGohm.tasks)}
DIEFI [${oDiefi.count}]:
${fmtOverdue(oDiefi.tasks)}

${d.errors && d.errors.length ? '⚠️ Collection issues (mention in the briefing if they hide data Cem relies on): ' + d.errors.join('; ') + '\n' : ''}
═══════════════════ PRODUCE THE BRIEFING ═══════════════════
Write in Slack markdown (*bold*, not **). Start DIRECTLY with the cockpit (no title/date line — one is prepended). STRUCTURE: a short cross-org COCKPIT, then ONE self-contained block per company. Use a divider line "───────────" between the cockpit and each company block. The cockpit is delivered as the main Slack message and the company blocks go to a thread — so the cockpit must stand alone. Keep each company's content fully inside its block — do NOT mix orgs.

══════ COCKPIT (cross-org — HARD LIMIT 400 words; this is the only part Cem is guaranteed to read) ══════
*🎯 YOUR DAY* — THE deliverable: the 3–5 things CEM PERSONALLY should do today, ranked by this rubric (highest first):
   (1) production/customer impact happening now → (2) external deadline today/tomorrow → (3) unblocks another person → (4) advances a 2026 goal → (5) everything else.
   Each line: "N. <link|action verb + object> — why now · ⏱ estimate". Sum of estimates ≤ 60 min. If Cem stated a focus in HIS RECENT MESSAGES, item 1 MUST serve it and say "(your stated focus)". Actions you'd otherwise scatter through the briefing ("ping X", "confirm Y") belong ONLY here or in the ledger — do not sprinkle asks elsewhere.
*🔁 Since Yesterday* — derive STRICTLY from the OPEN ISSUE LEDGER + today's data: STILL OPEN (use the ledger's day counts verbatim), RESOLVED (say what closed it), NEW. 3–5 lines. If the ledger is empty: "First structured run — ledger seeded."
*📌 Today's Schedule* — all orgs on ONE timeline; each meeting tagged 🔴 must-attend / 🟡 optional / ⚪ routine AND [FS]/[GOHM]/[DIEFI]; note prep; resolve conflicts.
*🔥 Top Priorities* (max 6) — ranked ACROSS all orgs with the SAME rubric as YOUR DAY, each tagged [FS]/[GOHM]/[DIEFI] AND with the 2026 goal it advances as [G: <3-4 word goal shorthand>] or [off-roadmap]. CONNECT signals; PULL IN any ⚡ escalations. Reference email tags like [FS3]. ALWAYS pull in any payment / fee / invoice / deadline / suspension / account-closure notice from the inboxes WITH its date and amount — never bury a "pay-or-it-gets-cancelled" item.
*⏳ Overdue (yours: ${overdueTotal})* — pick the 3 most consequential of Cem's overdue tasks: each with its link + one verdict: DO today / RESCHEDULE to <date> / DELEGATE to <person>. ${isFriday ? 'Friday sweep: after the top 3, group the REST into "reschedule / delegate / drop candidates" buckets (counts + a few named examples) so the debt actually shrinks.' : 'One closing line: what the remaining count is and the single oldest item.'}
*🗣️ From Yesterday's Meetings* — all orgs; decisions/action items landing on Cem. 1 line/meeting; skip routine standups unless notable. If notes are missing for meetings that happened, say so explicitly (never guess what happened).

───────────
══════ 🏭 FRESHSENS ══════
*Development* — per dev team (ML · Hardware · Firmware · Backend · Software · Postharvest) where inferable: shipped (✓) / in flight / blockers / who's driving. Weave in the NEW task comments (real progress/decisions).
*Board hygiene* — surface the ⚠️ flags (stale in-progress, missing story points, nothing in review) as a gentle nudge — the team doesn't always keep the board honest.
*Management* — one line: what Baran/Cem moved.
*🚨 Incidents* — correlate FreshSens Slack alarms into incidents (severity, root-cause hypothesis, owner, next action): #fs-alerts, #thingsboard_alarms, #operation-alerts, #deployments, #produce_alarms, #support. If quiet, say so.
${isFriday ? '*📊 Weekly Review* — completed issues + story points PER PERSON this week (from the weekly data above; actor-credited), the Multica Agent\'s deliveries (separate line, do not double-count), and a short Sales / Team Leads / Fundraising summary. Mirror Cem\'s sheet people: Gabby, Sevval, Sina Can, Sultan, Muhammad, Multica Agent.\n' : ''}*📨 Inbox — FreshSens* (ca@freshsens.ai) — Cem curates this inbox himself, so treat every FS email as kept-on-purpose: (a) *Reply needed* (max 5) — sender + ask + [tag]; (b) *Delegate* — who owns it. Do NOT suggest archiving. If any ⚠️ SAFETY NET item is FreshSens, flag it: "arrived but not in your inbox — looks urgent, did you mean to clear it?"

───────────
══════ 🛰️ GOHM ══════
*Projects* — Management hub (Robust6G coordination), Robust6G deadlines (D1.4 etc.), Q-TRUST6G (incoming): status, what moved, what needs Cem. Keep GM altitude: projects, deadlines, people — not code detail.
*🚨 Incidents* — correlate GOHM alarms (#gohm-alerts, e.g. Meysu flapping) into incidents. If quiet, say so.
*📨 Inbox — GOHM* (cem.ayyildiz@gohm.tech) — Cem curates this inbox; triage the GO-tagged emails: reply / delegate (do NOT suggest archiving). Flag any GOHM ⚠️ SAFETY NET item the same way. NOTE: DIEFI-related mail also arrives here — route DIEFI items to the DIEFI block below.

───────────
══════ 🔬 DIEFI ══════
*Progress* — DIEFI Development board: what moved, deliverable deadlines, what needs Cem (incl. any DIEFI items from the GOHM inbox).

───────────
══════ 🏠 PERSONAL / SMART HOME ══════
2–4 lines on open Home items; flag anything time-sensitive.

══════ ✅ Quick Wins ══════
(1–3) closable in <15 min, any org, each with its link.

Rules: direct, no filler, no restating raw data. Tight lines (1–2 each). NEVER mix orgs across blocks. Slack mrkdwn STRICT: *single asterisks* for bold (never **), links as <url|text>, no markdown tables, no "|" pipes outside links — use "• Label — value" bullets. Cockpit ≤ 400 words; whole briefing hard cap 1100 words.

After the prose, on a new line, output EXACTLY one fenced JSON block — this is tomorrow's OPEN ISSUE LEDGER, so treat it as a database update, not a summary:
\`\`\`json
{"open_issues": [{"title": "short stable name", "org": "fs|gohm|diefi|personal", "severity": "high|med|low", "owner": "person or ?", "next_action": "one line", "first_seen": "YYYY-MM-DD"}]}
\`\`\`
Ledger rules: (a) CARRY every still-open ledger item, KEEPING its original first_seen date EXACTLY; (b) NEW issues get first_seen=${d.todayDate}; (c) RESOLVED items are dropped from the JSON (mention them in Since Yesterday instead); (d) max 15 items — merge duplicates, drop stale trivia; (e) titles must stay stable day-to-day so items are trackable.`;

return [{ json: { prompt, todayDate: d.todayDate, emailIndex } }];
