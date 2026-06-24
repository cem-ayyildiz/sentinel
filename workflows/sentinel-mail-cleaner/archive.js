// Archive emails that got a 'skip' verdict: remove INBOX, add Sentinel/FYI-Archived. Never deletes.
const items = $input.all().map(i => i.json).filter(x => x && x.source_ref);
if (!items.length) return [];
const FS = { id: '836787456970-1rrue4ph9lhv0gesi8mq2i0auhppbkev.apps.googleusercontent.com', secret: '__GOOGLE_CLIENT_SECRET__', rt: '__GOOGLE_REFRESH_TOKEN__' };
const GOHM = { id: '623417040507-4pe98u0bsd3tdrdgiclch6ad0ioprkbr.apps.googleusercontent.com', secret: '__GOOGLE_CLIENT_SECRET__', rt: '__GOOGLE_REFRESH_TOKEN__' };
const cred = (org) => org === 'gohm' ? GOHM : FS;

const token = async (c) => {
  const r = await this.helpers.httpRequest({ method: 'POST', url: 'https://oauth2.googleapis.com/token',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${c.id}&client_secret=${c.secret}&refresh_token=${encodeURIComponent(c.rt)}&grant_type=refresh_token` });
  return (typeof r === 'string' ? JSON.parse(r) : r).access_token;
};
const ensureLabel = async (tok) => {
  const r = await this.helpers.httpRequest({ method: 'GET', url: 'https://gmail.googleapis.com/gmail/v1/users/me/labels', headers: { Authorization: `Bearer ${tok}` } });
  const d = typeof r === 'string' ? JSON.parse(r) : r;
  const f = (d.labels || []).find(l => l.name === 'Sentinel/FYI-Archived');
  if (f) return f.id;
  const c = await this.helpers.httpRequest({ method: 'POST', url: 'https://gmail.googleapis.com/gmail/v1/users/me/labels',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: { name: 'Sentinel/FYI-Archived', labelListVisibility: 'labelShow', messageListVisibility: 'show' }, json: true });
  return (typeof c === 'string' ? JSON.parse(c) : c).id;
};

const tok = {}, lbl = {};
const out = [];
for (const it of items) {
  const a = it.org === 'gohm' ? 'gohm' : 'fs';
  try {
    if (!tok[a]) tok[a] = await token(cred(it.org));
    if (!lbl[a]) lbl[a] = await ensureLabel(tok[a]);
    await this.helpers.httpRequest({ method: 'POST',
      url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${it.source_ref}/modify`,
      headers: { Authorization: `Bearer ${tok[a]}`, 'Content-Type': 'application/json' },
      body: { removeLabelIds: ['INBOX'], addLabelIds: [lbl[a]] }, json: true });
    out.push({ json: { id: it.id, ok: true } });
  } catch (e) { /* leave unmarked -> retried next sweep */ }
}
return out;
