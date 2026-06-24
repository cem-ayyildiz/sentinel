const wh = $('Chat In').first().json;
const q = (wh.body && wh.body.text) || (wh.query && wh.query.text) || 'give me a status overview';
const cu = $('Gather ClickUp').first().json.clickup || [];
const ctx = $('Load Context').first().json || {};
const cuStr = cu.map(o => {
  if (o.error) return `${o.org}: (error)`;
  const ppl = Object.entries(o.people || {}).map(([n, ts]) => `  *${n}*:\n${ts.map(x => '    ' + x).join('\n')}`).join('\n');
  return `*${o.org}* — ${o.totalUpdated} tasks active in 7d:\n${ppl || '  (quiet)'}`;
}).join('\n\n');
const prompt = `You are Sentinel, Cem Ayyildiz's chief-of-staff assistant. Answer his question using ONLY the live data below. Be concise and specific — name people, projects, statuses. If the data doesn't cover it, say so plainly.

CEM'S QUESTION: ${q}

═══ WHO'S DOING WHAT (ClickUp activity, last 7 days) ═══
${cuStr || '(no activity)'}

═══ CEM'S RECENT TRIAGE DECISIONS ═══
${JSON.stringify(ctx.recent_decisions || []).substring(0, 2000)}

═══ TASKS SENTINEL HAS CREATED ═══
${JSON.stringify(ctx.recent_actions || [])}

Answer in Slack markdown (*bold*), under 250 words.`;
return [{ json: { prompt } }];
