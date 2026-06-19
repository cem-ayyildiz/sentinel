// ===== Build AI Prompt from collected data =====
const d = $input.first().json;

const fmtEmails = (arr) => (arr && arr.length)
  ? arr.map(e => `- ${e.unread ? '🔵 ' : ''}${e.starred ? '⭐ ' : ''}${e.important ? '❗ ' : ''}*${e.subject}* | from ${e.from}\n  ${e.snippet}`).join('\n')
  : '_none_';

const fmtEvents = (arr) => (arr && arr.length)
  ? arr.map(e => `- ${e.start.substring(0, 16).replace('T', ' ')} — *${e.summary}*${e.location ? ' @ ' + e.location : ''}${e.attendees ? ' | with: ' + e.attendees : ''}`).join('\n')
  : '_none_';

const fmtTasks = (arr) => (arr && arr.length)
  ? arr.map(t => `- [${t.priority}] *${t.name}* | due ${t.due} | ${t.space}${t.status ? ' | ' + t.status : ''}`).join('\n')
  : '_none_';

const fmtSlack = (arr) => {
  if (!arr || !arr.length) return '_no channels read_';
  return arr.map(c => {
    if (!c.count) return `*#${c.channel}*: quiet (no activity)`;
    return `*#${c.channel}* (${c.count} msgs):\n${c.messages.map(m => '  · ' + m).join('\n')}`;
  }).join('\n\n');
};

const fmtNotes = (arr) => (arr && arr.length)
  ? arr.map(n => `### ${n.title}\n${n.summary}`).join('\n\n')
  : '_no meeting notes since yesterday_';

// Team activity per project (space)
const fmtActivity = (org) => {
  const a = (d.clickupActivity || []).find(c => c.org === org);
  if (!a || !a.totalUpdated) return '_no task activity in last 48h_';
  return a.spaces.map(s => {
    const head = `▸ *${s.space}* — ${s.completed} done / ${s.active} in flight${s.topPeople.length ? ' · ' + s.topPeople.join(', ') : ''}`;
    const lines = s.tasks.map(t => `   ${t.done ? '✓' : '•'} ${t.name.substring(0, 60)} | ${t.status} | ${t.assignee}`).join('\n');
    return head + '\n' + lines;
  }).join('\n');
};

// Cem's personal overdue
const cuOver = (org) => (d.clickupOverdue || []).find(c => c.org === org) || { count: 0, tasks: [] };
const fmtOverdue = (arr) => (arr && arr.length)
  ? arr.map(t => `- [${t.priority}] ${t.name.substring(0, 60)} | due ${t.due} | ${t.space}`).join('\n')
  : '_none_';
const oFs = cuOver('FreshSens'), oGohm = cuOver('GOHM'), oDiefi = cuOver('DIEFI');

const prompt = `You are Sentinel — the personal chief-of-staff AI for Cem Ayyildiz, who is CTO of FreshSens (deep-tech agritech/post-harvest sensing startup), General Manager of GOHM (telecom/6G R&D company), and a lead on DIEFI (an EU research project). Today is ${d.todayDate}.

You have his raw inbox, calendars, team Slack, and task boards below. Your job: cut through the noise and produce a sharp, exception-based morning briefing that tells him what actually deserves his attention today across all three hats.

═══════════════ INBOX — FreshSens (ca@freshsens.ai) ═══════════════
${fmtEmails(d.emailsFs)}

═══════════════ INBOX — GOHM (cem.ayyildiz@gohm.tech) ═══════════════
${fmtEmails(d.emailsGohm)}

═══════════════ CALENDAR — FreshSens (yesterday → today) ═══════════════
${fmtEvents(d.calFs)}

═══════════════ CALENDAR — GOHM (yesterday → today) ═══════════════
${fmtEvents(d.calGohm)}

═══════════════ MEETING NOTES — Gemini summaries since yesterday (context for what was discussed/decided) ═══════════════
${fmtNotes(d.meetingNotes)}

═══════════════ SLACK — last 24h activity ═══════════════
${fmtSlack(d.slack)}

═══════════════ TEAM ACTIVITY — last 48h, per project (✓ = shipped, • = in flight) ═══════════════
— FreshSens —
${fmtActivity('FreshSens')}

— GOHM —
${fmtActivity('GOHM')}

— DIEFI —
${fmtActivity('DIEFI')}

═══════════════ OVERDUE — assigned to Cem personally ═══════════════
— FreshSens [${oFs.count}] —
${fmtOverdue(oFs.tasks)}

— GOHM [${oGohm.count}] —
${fmtOverdue(oGohm.tasks)}

— DIEFI [${oDiefi.count}] —
${fmtOverdue(oDiefi.tasks)}

${d.errors && d.errors.length ? '⚠️ Collection issues: ' + d.errors.join('; ') + '\n' : ''}
═══════════════ YOUR BRIEFING ═══════════════
Write a briefing with these sections (use Slack markdown — *bold*, not **):

*📌 Today's Schedule* — list today's actual meetings chronologically. Tag EACH meeting with an attendance call:
   🔴 *Must attend* — your presence is decision-critical (external partners/customers, you're presenting, board/management, escalations, anything where a decision needs you).
   🟡 *Optional* — useful but delegable; join if time allows.
   ⚪ *Routine* — recurring standup/daily/sync; skip or just skim the auto-notes.
   Use the signals: names like "Daily", "Standup", "Sync" + only-internal team = routine; external attendees, demos, partner/customer calls, management = must-attend. Note prep needed, and for time conflicts say which one wins and what to do with the other.

*🔥 Top Priorities* (max 6) — the few things that truly matter today, pulled from across email/tasks/slack/meeting notes. For each: one line, action-oriented, tagged [FS]/[GOHM]/[DIEFI]. Connect dots (e.g. a decision or action item from yesterday's meeting notes that needs follow-up, an email + an overdue task that relate).

*🗣️ From Yesterday's Meetings* — using the Gemini meeting notes, 1 line per meeting: the key decision or the action item that lands on Cem (or that he must chase). Skip routine standups unless something notable came up. If no notes, say so in one line.

*👥 Team Pulse — by project* — this is Cem's window into what his teams are actually doing. For each active project (space) with movement, write 1–2 lines: what shipped (✓), what's in flight, who's driving it, and any project that looks stalled or where one person carries everything. Group under FreshSens / GOHM / DIEFI. Name the projects and people. If an org was quiet, say so in one line.

*📨 Emails Needing a Reply* (max 5) — only ones that genuinely need Cem personally. Name the sender and the ask.

*⚠️ Risks & Signals* (max 4) — blockers, alarms (esp. #thingsboard_alarms / #support), things going sideways, deadlines slipping.

*✅ Quick Wins* (1–3) — things closable in <15 min.

*📥 Archive Suggestions* — review the two inboxes and list ONLY emails that are purely informational / automated / FYI with no action or reply needed (newsletters, no-reply notifications, system digests, receipts, social/promo that slipped into inbox). For each: \`sender — subject\`. These are CANDIDATES Cem may archive — do NOT include anything starred (⭐), marked important (❗), from a real person addressing him, or that could need a reply. When in doubt, leave it out. If nothing is clearly archivable, say "Nothing safe to auto-archive today." (This is a suggestion list only — nothing is archived yet.)

Rules: Be direct and specific — reference real names, subjects, task titles. No filler, no restating raw data. If a section is genuinely empty, write one line saying so. Separate the three orgs clearly. Hard cap 750 words.`;

return [{ json: { prompt, todayDate: d.todayDate } }];
