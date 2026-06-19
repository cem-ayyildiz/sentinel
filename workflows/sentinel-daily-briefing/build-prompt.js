// ===== Build Analyst Prompt — deep, multi-pass reasoning over all collected data =====
const d = $input.first().json;

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

const yesterday = d.yesterdayBriefing
  ? d.yesterdayBriefing
  : '_(no prior briefing found — first run)_';

const prompt = `You are Sentinel — chief-of-staff AI for Cem Ayyildiz: CTO of FreshSens (deep-tech agritech/post-harvest sensing startup), GM of GOHM (telecom/6G R&D), lead on DIEFI (EU research project). Today is ${d.todayDate}.

You are NOT a summarizer. You are an analyst. Read everything below, then REASON: correlate signals across sources, weigh what matters, track continuity from yesterday, and decide concrete actions. Be specific — real names, subjects, task titles, channel names.

╔═══════════ YESTERDAY'S BRIEFING (for continuity) ═══════════╗
${yesterday}
╚════════════════════════════════════════════════════════════╝

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

═══════════ TEAM ACTIVITY — last 48h per project (✓ shipped, • in flight) ═══════════
— FreshSens —
${fmtActivity('FreshSens')}
— GOHM —
${fmtActivity('GOHM')}
— DIEFI —
${fmtActivity('DIEFI')}

═══════════ OVERDUE — assigned to Cem ═══════════
FreshSens [${oFs.count}]:
${fmtOverdue(oFs.tasks)}
GOHM [${oGohm.count}]:
${fmtOverdue(oGohm.tasks)}
DIEFI [${oDiefi.count}]:
${fmtOverdue(oDiefi.tasks)}

${d.errors && d.errors.length ? '⚠️ Collection issues: ' + d.errors.join('; ') + '\n' : ''}
═══════════════════ PRODUCE THE BRIEFING ═══════════════════
Write in Slack markdown (*bold*, not **). Sections, in order:

*🔁 Since Yesterday* — compare to yesterday's briefing. What's STILL OPEN (and now older/riskier), what got RESOLVED, what's NEW today. 3–5 lines. If no prior briefing, say "First run — baseline established."

*📌 Today's Schedule* — each meeting tagged 🔴 must-attend / 🟡 optional / ⚪ routine (routine = internal daily/standup; must-attend = external/partner/customer, you present, decisions). Note prep; resolve time conflicts (say which wins).

*🔥 Top Priorities* (max 6) — ranked. Each: one action-oriented line, tagged [FS]/[GOHM]/[DIEFI]. CONNECT signals — e.g. an overdue task blocking a customer email, a meeting action that needs a task. Reference the email tag [FS3] when relevant.

*🚨 Issues & Incidents* — correlate the Slack alarms/errors/support signals into INCIDENTS, don't just echo them. For each: severity (🔴/🟠/🟡), what's happening, likely root-cause hypothesis if signals cluster (e.g. several backend 500s + sensors offline = same gateway?), suspected owner, and the next action. Cover #*-alerts, #thingsboard_alarms, #support, #produce_alarms, #operation-alerts, #deployments. If genuinely quiet, say so.

*🗣️ From Yesterday's Meetings* — from the Gemini notes, the decisions/action items that land on Cem or that he must chase. 1 line per meeting; skip routine standups unless notable.

*👥 Team Pulse — by project* — per active project: what shipped (✓), what's in flight, who's driving, and flag single-person bottlenecks or stalls. Group FS/GOHM/DIEFI.

*📨 Inbox Triage* — you have ${(d.emailsFs||[]).length + (d.emailsGohm||[]).length} inbox emails above. Give: (a) *Reply needed* (max 6) — emails that genuinely need Cem; name sender + the ask + reference [tag]. (b) *Delegate* — who should own it. (c) *Archive (FYI)* — count + the tags you judge safe to archive (automated/bulk/no-reply/receipts/notifications, NOT starred/important/anything needing a person). List the safe tags.

*✅ Quick Wins* (1–3) — closable in <15 min.

Rules: direct, no filler, no restating raw data. Separate the orgs. Hard cap 850 words for the prose.

After the prose, on a new line, output EXACTLY one fenced JSON block with the machine-actionable decisions (this drives auto-archiving and tomorrow's continuity):
\`\`\`json
{"archive_tags": ["FS3","GO5"], "open_issues": ["one-line each: the issues/items that must carry to tomorrow"]}
\`\`\`
Only include email tags in archive_tags that are genuinely safe FYI to remove from inbox. Be conservative.`;

return [{ json: { prompt, todayDate: d.todayDate, emailIndex } }];
