const roadmap = $('Load Roadmap').first().json.doc || '(roadmap unavailable)';
const cu = $('Gather ClickUp').first().json.clickup || [];
const cuStr = cu.map(o => {
  if (o.error) return `${o.org}: (error)`;
  const ppl = Object.entries(o.people || {}).map(([n, ts]) => `  ${n}: ${ts.join('; ')}`).join('\n');
  return `*${o.org}* (${o.totalUpdated} tasks active in 7d):\n${ppl || '  (quiet)'}`;
}).join('\n\n');
const prompt = `You are Sentinel, Cem Ayyildiz's chief-of-staff. Produce a weekly ROADMAP PROGRESS report: where each 2026 strategic goal and each team stands versus the plan, judged from what the team is ACTUALLY doing now (live ClickUp). Be specific — cite real people and task names.

═══════════ FRESHSENS 2026 ROADMAP (the plan) ═══════════
${roadmap}

═══════════ WHAT THE TEAM IS DOING NOW (ClickUp, last 7 days, by person) ═══════════
${cuStr || '(no activity)'}

═══════════ WRITE THE REPORT (Slack markdown, *bold*, ~550 words) ═══════════
*🎯 Goal-by-Goal* — for each of the 5 strategic goals (1 Autonomous O2 Rescue · 2 Frictionless Deployment/Lid v2 · 3 Zero-Touch Tech Ops · 4 Predictive Quality · 5 Decentralized Scalability): one line on status — what's progressing (cite the ClickUp tasks/people that map to it), what's stalled or not yet started.

*👥 By Team* — Firmware, Software, ML, Hardware/Post-Harvest: are they working their roadmap L2 objectives? Flag who's on-plan vs working on things NOT in the roadmap.

*⚠️ Gaps & Drift* — roadmap objectives with no visible activity; and notable work happening that isn't in the roadmap.

*✅ On Track* — objectives/KPIs that look met or close.

Ground every claim in the live data; if a goal has no matching activity, say "no visible activity."`;
return [{ json: { prompt } }];
