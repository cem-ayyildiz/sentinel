// ===== Sentinel · Ingest — Normalize & Hash =====
// Accepts one Signal, an array of Signals, or {signals:[...]} (from any adapter).
// Produces normalized rows with a stable content_hash for dedup.
const items = $input.all();
let raw = [];
for (const it of items) {
  const b = (it.json && it.json.body !== undefined) ? it.json.body : it.json;  // webhook puts payload under .body
  if (Array.isArray(b)) raw.push(...b);
  else if (b && Array.isArray(b.signals)) raw.push(...b.signals);
  else if (b) raw.push(b);
}

// djb2 hash — no crypto dependency; good enough for dedup keys.
const h = (s) => {
  let x = 5381; const str = String(s);
  for (let i = 0; i < str.length; i++) { x = ((x << 5) + x) + str.charCodeAt(i); x |= 0; }
  return (x >>> 0).toString(36);
};

const out = raw.filter(Boolean).map(s => {
  const source = s.source || 'unknown';
  const source_ref = s.source_ref || null;
  const title = s.title || '';
  const body = s.body || '';
  // Prefer a stable natural key (source + source_ref); else hash the content.
  const content_hash = s.content_hash || `${source}:${source_ref || h(title + '|' + body)}`;
  return {
    source,
    source_ref,
    org: s.org || null,
    type: s.type || 'unknown',
    title,
    body,
    actor: s.actor || null,
    url: s.url || null,
    metadata: s.metadata || {},
    content_hash,
  };
});

return out.length ? out.map(json => ({ json })) : [{ json: { _empty: true } }];
