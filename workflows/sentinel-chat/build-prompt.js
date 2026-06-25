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
const prompt = `You are Sentinel, Cem Ayyildiz's chief-of-staff assistant. Answer his question using the live data below. Be concise and specific (names, dates, tasks). If the data doesn't cover it, say so.

CEM'S QUESTION: ${q}

═══ WHO'S DOING WHAT (ClickUp, 7d) ═══
${cuStr || '(none)'}

═══ INBOX — FreshSens (last 3 days) ═══
${mails(mc.emailsFs)}
═══ INBOX — GOHM (last 3 days) ═══
${mails(mc.emailsGohm)}

═══ CALENDAR — next 7 days (FS) ═══
${evs(mc.calFs)}
═══ CALENDAR — next 7 days (GOHM) ═══
${evs(mc.calGohm)}

═══ FRESHSENS 2026 ROADMAP ═══
${(ctx.roadmap || '(unavailable)').substring(0, 8000)}

═══ CEM'S RECENT TRIAGE DECISIONS ═══
${JSON.stringify(ctx.recent_decisions || []).substring(0, 1500)}
═══ TASKS SENTINEL CREATED ═══
${JSON.stringify(ctx.recent_actions || [])}

Answer in Slack markdown (*bold*), under 250 words unless he asks for detail.`;
return [{ json: { prompt } }];
