const wh = $('Chat In').first().json;
const q = (wh.body && wh.body.text) || (wh.query && wh.query.text) || 'status';
const conv = $('Gather Conversation').first().json.transcript || '(no prior conversation)';
const g = $('Gather ClickUp').first().json;
const boards = g.boards || []; const refBoards = g.refBoards || []; const taskIndex = g.taskIndex || [];
const mc = $('Gather Mail & Calendar').first().json.mailcal || {};
const ctx = $('Load Context').first().json || {};
let REG = []; try { REG = ($('Load Registry').first().json.workspaces) || []; } catch (e) {}
let aws = {}; try { aws = $('Load AWS Status').first().json || {}; } catch (e) {}
const spacesByOrg = ['freshsens','gohm','diefi'].map(o => {
  const ns = REG.filter(r => r.kind === 'clickup_space' && r.org === o).map(r => r.name);
  return ns.length ? `  ${o}: ${ns.join(' · ')}` : null;
}).filter(Boolean).join('\n');
const tc = (s) => String(s).replace(/\b\w/g, c => c.toUpperCase());
const sum = (sc) => Object.values(sc).reduce((a,c)=>a+c,0);
const spLine = (sp) => Object.entries(sp||{}).filter(([k,v])=>v.doneSP||v.remSP||v.doneN||v.remN)
  .sort((a,b)=>b[1].doneSP-a[1].doneSP)
  .map(([p,v])=>`    ${p}: ${v.doneSP} SP done+review (${v.doneN}t), ${v.remSP} SP remaining (${v.remN}t)`).join('\n');
const boardStr = boards.map(b => {
  if (b.error) return `*${b.org}*: (no board — ${b.error})`;
  const head = `*${b.org} — ${b.sprint}*${b.active ? ' (current sprint)' : ' (latest sprint — none active now)'} · ${b.total} tasks`;
  const tot = 'TOTALS — ' + b.order.map(s => `${tc(s)}: ${b.totals[s]}`).join(' · ');
  const rows = Object.entries(b.people).sort((x,y)=>sum(y[1])-sum(x[1]))
    .map(([p,sc]) => `  • ${p} — ` + b.order.map(s=>`${tc(s)} ${sc[s]||0}`).join(', ')).join('\n');
  const sp = spLine(b.sp);
  return `${head}\n${tot}\n${rows}` + (sp?`\n  STORY POINTS (done+review vs remaining):\n${sp}`:'\n  (no story points set on this board)');
}).join('\n\n');
const refStr = refBoards.map(b => {
  const head = `*REFERENCED BOARD: ${b.name}* (list ${b.listId}) · ${b.total} tasks · TOTALS ` + b.order.map(s=>`${tc(s)} ${b.totals[s]}`).join(', ');
  const lines = b.tasks.slice(0,80).map(t => `  ${t.id} | ${t.status} | ${t.points==null?'-':t.points}pts | ${(t.assignee.join(',')||'unassigned')} | ${t.name}`).join('\n');
  const sp = spLine(b.sp);
  return `${head}\n  (task_id | status | pts | assignee | name)\n${lines}` + (sp?`\n  STORY POINTS:\n${sp}`:'');
}).join('\n\n');
const mails = (arr) => (arr && arr.length) ? arr.map(e => `- *${e.subject}* — ${e.from}: ${e.snippet}`).join('\n') : '_none_';
const evs = (arr) => (arr && arr.length) ? arr.map(e => `- ${e.start} ${e.summary}`).join('\n') : '_none_';
const idx = taskIndex.map(t => `${t.id}: ${t.name} [${t.org}]`).join('\n');
const ec2 = aws.ec2_summary || {}; const s3 = aws.s3_summary || {}; const iam = aws.iam_summary || {};
const notRunning = (ec2.instances||[]).filter(i => i.state !== 'running').map(i => `${i.name||i.instance_id} (${i.state})`);
const exposedBuckets = (s3.buckets||[]).filter(b => b.status !== 'blocked').map(b => `${b.name} [${b.status}]`);
const flaggedUsers = (iam.users||[]).filter(u => (u.flags||[]).length).map(u => `${u.user_name}: ${(u.flags||[]).join(', ')}`);
const awsBlock = `EC2: ${ec2.running||0}/${ec2.total||0} running` +
  (notRunning.length ? ` — NOT running: ${notRunning.join(', ')}` : '') +
  `\nS3: ${s3.total||0} buckets, ${exposedBuckets.length} not fully locked down` +
  (exposedBuckets.length ? ` — ${exposedBuckets.join(', ')}` : '') +
  `\nIAM: ${iam.total_users||0} users, ${flaggedUsers.length} flagged` +
  (flaggedUsers.length ? `\n${flaggedUsers.map(f=>'  • '+f).join('\n')}` : '') +
  `\n(refreshed ${aws.refreshed_at || 'unknown'})`;
const prompt = `You are Sentinel, Cem Ayyildiz's chief-of-staff assistant. Continue the conversation and answer his latest message (or run his command). Use the prior conversation for context. Answer in the same language he used. Be specific.

═══ CONVERSATION SO FAR (oldest→newest) ═══
${conv}

═══ CEM'S LATEST MESSAGE ═══
${q}

═══ LIVE BOARDS — EXACT COUNTS + STORY POINTS (each org's sprint board) ═══
${boardStr || '(none)'}

═══ REFERENCED BOARD(S) — the specific board(s) Cem pointed to (full task list with real task_ids) ═══
${refStr || '(none referenced — if Cem asks to act on a board not shown here, ask him to paste its ClickUp link)'}

═══ RECENT TASKS (task_id: name) ═══
${idx || '(none)'}
═══ INBOX FS (3d) ═══
${mails(mc.emailsFs)}
═══ INBOX GOHM (3d) ═══
${mails(mc.emailsGohm)}
═══ CALENDAR next 7d ═══
${evs(mc.calFs)}
${evs(mc.calGohm)}
═══ 2026 ROADMAP ═══
${(ctx.roadmap || '(unavailable)').substring(0, 5000)}

═══ AWS STATUS (auto-refreshed hourly) ═══
${awsBlock}

───────────────
DATA RULES:
- LIVE BOARDS hold EXACT counts + story points — report verbatim, never estimate. "FreshSens development board" = FreshSens current sprint above.
- STORY POINTS: "done+review" already counts Review as completed (per Cem). If a board shows no points, say so plainly — do NOT invent SP.
- COMMENT TARGETING: only ever comment on a task_id that literally appears in REFERENCED BOARD or LIVE BOARDS/RECENT TASKS. To comment on "X's issues on the <board> board", use the task_ids under that REFERENCED BOARD whose assignee matches X. If the board Cem means is NOT in REFERENCED BOARD, do NOT guess — ask him to paste the board link. NEVER fire a comment at a task_id you are unsure about.

FORMATTING (Slack mrkdwn — strict): *single asterisks* for bold (NEVER **double**). NEVER use markdown tables or "|" columns in your prose to Cem — use "• *Name* — value" bullets. (The "|" rows above are DATA for you, not a format to copy.) Under 320 words unless full detail asked.

ACTIONS — if Cem commands one or more, write a brief one-line note per task in prose, then append a fenced json block PER action. Do NOT show task_ids or json in your prose.
• Create a task: \`\`\`json
{"action":"create_task","org":"freshsens|gohm|diefi","space":"<target space, see CLICKUP SPACES>","title":"...","description":"...","assignees":["Cem","Baran"],"followers":["Görkem"]}
\`\`\`
  ONE task can have MULTIPLE assignees — output ONE create_task with everyone in "assignees", never one task per person. "assignees" is always an array; [] if nobody named. When Cem refers to himself ("me", "I", "myself"), put "Cem" in assignees.
  "followers" = people to add as watchers (notified, kept in the loop — NOT responsible for the work). Also an array, [] if none. Use it when Cem says "add X as a follower/watcher", "cc X", or "keep X in the loop". Assignees are notified automatically, so don't repeat them in followers.
  "space" MUST be one of that org's CLICKUP SPACES below. Pick by intent: management / planning / strategy / hiring / financial / high-level → Management; dev / sprint / bug / firmware / ML / backend / frontend → Development; sales / marketing / ops → the Sales space. If unsure, use Management (the default home for Cem's issues).
═══ CLICKUP SPACES (valid "space" values per org) ═══
${spacesByOrg || '(registry unavailable — omit "space")'}
• Comment on a task: \`\`\`json
{"action":"add_comment","task_id":"<real id from REFERENCED BOARD / LIVE BOARDS>","comment":"<the actual comment text>"}
\`\`\`
Multiple comment blocks are fine (one per target task). If you cannot identify the exact task_id, ask instead of guessing.`;
return [{ json: { prompt } }];
