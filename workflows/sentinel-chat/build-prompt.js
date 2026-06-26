const wh = $('Chat In').first().json;
const q = (wh.body && wh.body.text) || (wh.query && wh.query.text) || 'status';
const conv = $('Gather Conversation').first().json.transcript || '(no prior conversation)';
const g = $('Gather ClickUp').first().json;
const boards = g.boards || []; const taskIndex = g.taskIndex || [];
const mc = $('Gather Mail & Calendar').first().json.mailcal || {};
const ctx = $('Load Context').first().json || {};
const tc = (s) => s.replace(/\b\w/g, c => c.toUpperCase());
const sum = (sc) => Object.values(sc).reduce((a,c)=>a+c,0);
const boardStr = boards.map(b => {
  if (b.error) return `*${b.org}*: (no board — ${b.error})`;
  const head = `*${b.org} — ${b.sprint}*${b.active ? ' (current sprint)' : ' (latest sprint — no active one now)'} · ${b.total} tasks`;
  const tot = 'TOTALS — ' + b.order.map(s => `${tc(s)}: ${b.totals[s]}`).join(' · ');
  const rows = Object.entries(b.people)
    .sort((x,y) => sum(y[1]) - sum(x[1]))
    .map(([p, sc]) => `  • ${p} — ` + b.order.map(s => `${tc(s)} ${sc[s]||0}`).join(', '))
    .join('\n');
  return `${head}\n${tot}\n${rows}`;
}).join('\n\n');
const mails = (arr) => (arr && arr.length) ? arr.map(e => `- *${e.subject}* — ${e.from}: ${e.snippet}`).join('\n') : '_none_';
const evs = (arr) => (arr && arr.length) ? arr.map(e => `- ${e.start} ${e.summary}`).join('\n') : '_none_';
const idx = taskIndex.map(t => `${t.id}: ${t.name} [${t.org}]`).join('\n');
const prompt = `You are Sentinel, Cem Ayyildiz's chief-of-staff assistant. Continue the conversation and answer his latest message (or run his command). Use the prior conversation for context — resolve references like "it", "that task", "the issue we discussed". Answer in the same language he used. Be specific.

═══ CONVERSATION SO FAR (oldest→newest) ═══
${conv}

═══ CEM'S LATEST MESSAGE ═══
${q}

═══ LIVE BOARD — EXACT COUNTS (each org's sprint board, by status & person) ═══
${boardStr || '(none)'}
═══ RECENT TASKS (task_id: name — for comment/reference) ═══
${idx || '(none)'}
═══ INBOX FS (3d) ═══
${mails(mc.emailsFs)}
═══ INBOX GOHM (3d) ═══
${mails(mc.emailsGohm)}
═══ CALENDAR next 7d ═══
${evs(mc.calFs)}
${evs(mc.calGohm)}
═══ 2026 ROADMAP ═══
${(ctx.roadmap || '(unavailable)').substring(0, 6000)}

───────────────
DATA RULES: The LIVE BOARD block holds EXACT live counts straight from ClickUp. When Cem asks how many tasks are Open / In Progress / Review / Closed (per person or in total), report those numbers VERBATIM — never re-derive or estimate from the RECENT TASKS list. "FreshSens development board" = the FreshSens current-sprint board above. If a count is 0, say 0. State which sprint the numbers are from.

FORMATTING (Slack mrkdwn — strict): *single asterisks* for bold (NEVER **double**). NEVER use markdown tables or "|" columns — Slack does not render them. For tabular data use one bullet per person: "• *Name* — Open 2, In Progress 1, Review 6, Closed 0". Keep it tight. Under 300 words unless Cem asks for full detail.

ACTIONS — if Cem commands one or more, write a brief one-line note per task in prose, then append a fenced json block PER action (several blocks only for genuinely DIFFERENT tasks; else NO json). Do NOT show task_ids or json contents in your prose — those run automatically.
• Create a task: \`\`\`json
{"action":"create_task","org":"freshsens|gohm|diefi","title":"...","description":"...","assignees":["Cem","Baran"]}
\`\`\`
  IMPORTANT: ONE task can have MULTIPLE assignees. If Cem asks to open a task FOR several people (e.g. "bana ve Baran'a bir task aç"), output exactly ONE create_task with every person listed in "assignees" — NEVER a separate task per person. Use multiple create_task blocks ONLY when the tasks are genuinely different pieces of work. "assignees" is always an array (one or many names); leave it [] if nobody is named.
• Comment on a task ("yorum olarak yaz", "add a comment to..."): pick the task_id from RECENT TASKS using the conversation, then: \`\`\`json
{"action":"add_comment","task_id":"<id from RECENT TASKS>","comment":"<text — write the actual comment content, e.g. your analysis>"}
\`\`\`
If you can't tell which task, ask instead of guessing.`;
return [{ json: { prompt } }];
