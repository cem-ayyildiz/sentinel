const wh = $('Chat In').first().json;
const q = (wh.body && wh.body.text) || (wh.query && wh.query.text) || 'give me a status overview';
const cu = $('Gather ClickUp').first().json.clickup || [];
const mc = $('Gather Mail & Calendar').first().json.mailcal || {};
const ctx = $('Load Context').first().json || {};
const cuStr = cu.map(o => { if (o.error) return `${o.org}: (error)`;
  const ppl = Object.entries(o.people || {}).map(([n, ts]) => `  *${n}*: ${ts.join('; ')}`).join('\n');
  return `*${o.org}* (${o.totalUpdated} active in 7d):\n${ppl || '  (quiet)'}`; }).join('\n\n');
const mails = (arr) => (arr && arr.length) ? arr.map(e => `- *${e.subject}* — ${e.from}: ${e.snippet}`).join('\n') : '_none_';
const evs = (arr) => (arr && arr.length) ? arr.map(e => `- ${e.start} ${e.summary}${e.attendees ? ' | ' + e.attendees : ''}`).join('\n') : '_none_';
const prompt = `You are Sentinel, Cem Ayyildiz's chief-of-staff assistant. Answer his question (or run his command) using the live data below. Be concise and specific. If the data doesn't cover it, say so. Answer in the same language he used.

CEM'S MESSAGE: ${q}

═══ WHO'S DOING WHAT (ClickUp, 7d) ═══
${cuStr || '(none)'}
═══ INBOX — FreshSens (3d) ═══
${mails(mc.emailsFs)}
═══ INBOX — GOHM (3d) ═══
${mails(mc.emailsGohm)}
═══ CALENDAR — next 7 days (FS) ═══
${evs(mc.calFs)}
═══ CALENDAR — next 7 days (GOHM) ═══
${evs(mc.calGohm)}
═══ FRESHSENS 2026 ROADMAP ═══
${(ctx.roadmap || '(unavailable)').substring(0, 7000)}
═══ RECENT DECISIONS ═══
${JSON.stringify(ctx.recent_decisions || []).substring(0, 1200)}
═══ TASKS SENTINEL CREATED ═══
${JSON.stringify(ctx.recent_actions || [])}

───────────────
FORMATTING (Slack mrkdwn — strict): use *single asterisks* for bold (NEVER **double**). Do NOT use markdown tables or "|" pipes — use bullet lines like "• Label — value". Under 250 words unless he asks for detail.

ACTIONS: If Cem is asking you to CREATE a task in ClickUp (e.g. "create a task...", "add to clickup...", "şunun için görev aç...", "remind the team to..."), confirm briefly in prose AND append EXACTLY one fenced json block:
\`\`\`json
{"action":"create_task","org":"freshsens|gohm|diefi","title":"<short imperative title>","description":"<what + why>","assignee":"<name if he named one, else empty>"}
\`\`\`
Pick org from context (default freshsens). For a normal question, do NOT output any json block.`;
return [{ json: { prompt } }];
