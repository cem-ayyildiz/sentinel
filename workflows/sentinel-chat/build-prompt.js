const wh = $('Chat In').first().json;
const q = (wh.body && wh.body.text) || (wh.query && wh.query.text) || 'status';
const conv = $('Gather Conversation').first().json.transcript || '(no prior conversation)';
const g = $('Gather ClickUp').first().json;
const cu = g.clickup || []; const taskIndex = g.taskIndex || [];
const mc = $('Gather Mail & Calendar').first().json.mailcal || {};
const ctx = $('Load Context').first().json || {};
const cuStr = cu.map(o => { if (o.error) return `${o.org}: (error)`;
  const ppl = Object.entries(o.people || {}).map(([n, ts]) => `  *${n}*: ${ts.join('; ')}`).join('\n');
  return `*${o.org}* (${o.totalUpdated} active in 7d):\n${ppl || '  (quiet)'}`; }).join('\n\n');
const mails = (arr) => (arr && arr.length) ? arr.map(e => `- *${e.subject}* — ${e.from}: ${e.snippet}`).join('\n') : '_none_';
const evs = (arr) => (arr && arr.length) ? arr.map(e => `- ${e.start} ${e.summary}`).join('\n') : '_none_';
const idx = taskIndex.map(t => `${t.id}: ${t.name} [${t.org}]`).join('\n');
const prompt = `You are Sentinel, Cem Ayyildiz's chief-of-staff assistant. Continue the conversation and answer his latest message (or run his command). Use the prior conversation for context — resolve references like "it", "that task", "the issue we discussed". Answer in the same language he used. Be specific.

═══ CONVERSATION SO FAR (oldest→newest) ═══
${conv}

═══ CEM'S LATEST MESSAGE ═══
${q}

═══ WHO'S DOING WHAT (ClickUp, 7d) ═══
${cuStr || '(none)'}
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
FORMATTING (Slack mrkdwn — strict): *single asterisks* for bold (NEVER **double**). No markdown tables or "|" — use "• Label — value" bullets. Under 250 words unless detail is asked.

ACTIONS — if Cem commands one, confirm briefly in prose AND append EXACTLY one fenced json block (else NO json):
• Create a task: \`\`\`json
{"action":"create_task","org":"freshsens|gohm|diefi","title":"...","description":"...","assignee":""}
\`\`\`
• Comment on a task ("yorum olarak yaz", "add a comment to..."): pick the task_id from RECENT TASKS using the conversation, then: \`\`\`json
{"action":"add_comment","task_id":"<id from RECENT TASKS>","comment":"<text — write the actual comment content, e.g. your analysis>"}
\`\`\`
If you can't tell which task, ask instead of guessing.`;
return [{ json: { prompt } }];
