const raw = $input.first().json.text || $input.first().json.output || '';
const items = $('Load Actionable').all().map(i => i.json).filter(s => s && s.id);
let drafts = []; const m = raw.match(/\[[\s\S]*\]/); if (m) { try { drafts = JSON.parse(m[0]); } catch (e) {} }
const byN = {}; drafts.forEach(d => { byN[d.n] = d; });
const TOKEN = '__SLACK_BOT_TOKEN__'; const CH = 'D0BBRKKPGUE';
const post = (text) => this.helpers.httpRequest({ method: 'POST', url: 'https://slack.com/api/chat.postMessage',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: { channel: CH, text, unfurl_links: false }, json: true });
// Registry-driven target space: match the item against each space's routing_keywords,
// default to Management per org, and flag ambiguous (no keyword hit) so Cem can redirect.
let REG = []; try { REG = ($('Load Registry').first().json.workspaces) || []; } catch (e) {}
const SPACES = REG.filter(r => r.kind === 'clickup_space');
const DEF = { freshsens: '90010053606', gohm: '90090428426', diefi: '90143023495' };
// Word-boundary match: short/generic dev keywords ("ml","ota","api","bug","model")
// must NOT substring-hit ordinary management words (html, total, capital, budget,
// "operating model") — that was routing freshsens issues to Development by accident.
const kwHit = (hay, k) => {
  const kk = String(k).toLowerCase().trim();
  if (!kk) return false;
  const re = new RegExp('(^|[^a-z0-9])' + kk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)');
  return re.test(hay);
};
const pickSpace = (s) => {
  const hay = ((s.title || '') + ' ' + (s.body || '') + ' ' + (s.reason || '')).toLowerCase();
  const orgSp = SPACES.filter(x => x.org === s.org);
  const def = orgSp.find(x => x.id === DEF[s.org]) || orgSp[0] || null;
  let best = null, sc = 0;
  for (const sp of orgSp) {
    const kws = (sp.config && sp.config.routing_keywords) || [];
    const n = kws.filter(k => kwHit(hay, k)).length;
    // strictly more keyword hits wins; on a tie the default space (Management) keeps it.
    if (n > sc || (n === sc && n > 0 && sp === def)) { sc = n; best = sp; }
  }
  return { space: best || def, ambiguous: !best };
};
const out = [];
for (let i = 0; i < items.length; i++) {
  const s = items[i]; const d = byN[i + 1] || {};
  const title = (d.title || s.title || 'Task').substring(0, 80);
  const desc = `${d.description || ''}\n\n— From: ${s.actor || ''}\n— Source: ${s.url || ''}\n— Cem's note: ${s.reason || '(reaction)'}`;
  const tgt = pickSpace(s);
  const sn = tgt.space ? tgt.space.name : 'Sentinel Inbox';
  const tline = `🎯 ${sn}${tgt.ambiguous ? ' (default — react ✅ to accept, or reply with the right board)' : ''}`;
  const text = `📋 *Create ClickUp task* · _${s.org}_\n*${title}*\n${d.description || ''}\n👤 ${d.assignee_hint || '—'}  ·  📅 ${d.due_hint || '—'}\n${tline}\n_react ✅ to create · ❌ to skip_`;
  const r = await post(text);
  if (r && r.ok) out.push({ json: { signal_id: s.id, org: s.org, payload: JSON.stringify({ title, description: desc, assignee_hint: d.assignee_hint || null, due: d.due_hint || null, space_id: tgt.space ? tgt.space.id : null, space_name: sn, ambiguous: tgt.ambiguous }), slack_ts: r.ts } });
}
return out;
