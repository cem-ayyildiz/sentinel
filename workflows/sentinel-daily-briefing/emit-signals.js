// ===== Emit Signals — map today's collected items into normalized Signal rows =====
// Branches off Collect All Sources; feeds Insert Signals. Decidable items only
// (emails, overdue tasks, meeting notes) — the substrate the decision loop learns from.
const d = $input.first().json;
const sigs = [];
const gmailUrl = (org, id) =>
  `https://mail.google.com/mail/?authuser=${org === 'freshsens' ? 'ca@freshsens.ai' : 'cem.ayyildiz@gohm.tech'}#all/${id}`;

for (const [arr, org] of [[d.emailsFs, 'freshsens'], [d.emailsGohm, 'gohm']]) {
  for (const e of (arr || [])) {
    if (!e.id) continue;
    sigs.push({
      source: 'gmail', source_ref: e.id, org, type: 'email',
      title: e.subject || '(no subject)', body: e.snippet || '', actor: e.from || null,
      url: gmailUrl(org, e.id),
      metadata: { unread: !!e.unread, important: !!e.important, starred: !!e.starred,
                  category: e.category, bulk: !!e.bulk, automated: !!e.automated },
    });
  }
}

for (const [name, org] of [['FreshSens', 'freshsens'], ['GOHM', 'gohm'], ['DIEFI', 'diefi']]) {
  const o = (d.clickupOverdue || []).find(c => c.org === name);
  for (const t of ((o && o.tasks) || [])) {
    sigs.push({
      source: 'clickup', source_ref: t.id || null, org, type: 'task',
      title: t.name || '(untitled task)', body: `overdue — due ${t.due}; ${t.space}`,
      actor: null, url: t.url || null,
      metadata: { status: t.status, priority: t.priority, space: t.space, due: t.due },
    });
  }
}

for (const n of (d.meetingNotes || [])) {
  sigs.push({
    source: 'drive', source_ref: n.id || null, org: null, type: 'meeting_note',
    title: n.title || 'Meeting', body: (n.summary || '').substring(0, 1000),
    actor: null, url: null, metadata: {},
  });
}

// djb2 fallback hash (matches Ingest) for rows without a stable source_ref.
const h = (s) => { let x = 5381; const str = String(s); for (let i = 0; i < str.length; i++) { x = ((x << 5) + x) + str.charCodeAt(i); x |= 0; } return (x >>> 0).toString(36); };
const rows = sigs.map(s => ({
  ...s,
  content_hash: `${s.source}:${s.source_ref || h((s.title || '') + '|' + (s.body || ''))}`,
}));

return rows.length ? rows.map(json => ({ json })) : [];
