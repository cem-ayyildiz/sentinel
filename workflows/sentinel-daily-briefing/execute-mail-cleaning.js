// ===== Execute Mail Cleaning — archive the FYI emails the analyst flagged =====
// SAFETY: gated by ARCHIVE_ENABLED. While false, it only PROPOSES (lists what it
// would archive). Archiving = remove INBOX label + add 'Sentinel/FYI-Archived'
// (an audit-trail folder). It NEVER deletes — archived mail stays in All Mail.
const ARCHIVE_ENABLED = false;   // flip to true once Cem is confident

const inp = $input.first().json;
const archive = inp.archive || [];
let briefing = inp.briefing || '';

const FS = { id: '836787456970-1rrue4ph9lhv0gesi8mq2i0auhppbkev.apps.googleusercontent.com', secret: '__GOOGLE_CLIENT_SECRET__', rt: '__GOOGLE_REFRESH_TOKEN__' };
const GOHM = { id: '623417040507-4pe98u0bsd3tdrdgiclch6ad0ioprkbr.apps.googleusercontent.com', secret: '__GOOGLE_CLIENT_SECRET__', rt: '__GOOGLE_REFRESH_TOKEN__' };
const acct = (a) => a === 'fs' ? FS : GOHM;

const token = async (c) => {
  const r = await this.helpers.httpRequest({
    method: 'POST', url: 'https://oauth2.googleapis.com/token',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${c.id}&client_secret=${c.secret}&refresh_token=${encodeURIComponent(c.rt)}&grant_type=refresh_token`,
  });
  const d = typeof r === 'string' ? JSON.parse(r) : r;
  return d.access_token;
};

const ensureLabel = async (tok) => {
  const r = await this.helpers.httpRequest({ method: 'GET', url: 'https://gmail.googleapis.com/gmail/v1/users/me/labels', headers: { Authorization: `Bearer ${tok}` } });
  const d = typeof r === 'string' ? JSON.parse(r) : r;
  const found = (d.labels || []).find(l => l.name === 'Sentinel/FYI-Archived');
  if (found) return found.id;
  const c = await this.helpers.httpRequest({
    method: 'POST', url: 'https://gmail.googleapis.com/gmail/v1/users/me/labels',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: { name: 'Sentinel/FYI-Archived', labelListVisibility: 'labelShow', messageListVisibility: 'show' }, json: true,
  });
  return (typeof c === 'string' ? JSON.parse(c) : c).id;
};

let archivedCount = 0;
const errors = [];
if (ARCHIVE_ENABLED && archive.length) {
  for (const a of ['fs', 'gohm']) {
    const items = archive.filter(x => x.account === a);
    if (!items.length) continue;
    try {
      const tok = await token(acct(a));
      const labelId = await ensureLabel(tok);
      for (const it of items) {
        try {
          await this.helpers.httpRequest({
            method: 'POST',
            url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${it.id}/modify`,
            headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
            body: { removeLabelIds: ['INBOX'], addLabelIds: [labelId] }, json: true,
          });
          archivedCount++;
        } catch (e) { errors.push(`${it.tag}: ${e.message}`); }
      }
    } catch (e) { errors.push(`${a}: ${e.message}`); }
  }
}

// Append a cleaning footer to the briefing.
let footer = '\n\n──────────\n*🧹 Mail Cleaning*\n';
if (!archive.length) {
  footer += 'Nothing flagged safe to archive today.';
} else if (ARCHIVE_ENABLED) {
  footer += `Archived ${archivedCount}/${archive.length} FYI emails → \`Sentinel/FYI-Archived\` label (still in All Mail, never deleted).`;
  if (errors.length) footer += `\n⚠️ ${errors.length} failed: ${errors.slice(0, 3).join('; ')}`;
} else {
  footer += `${archive.length} FYI emails are proposed for archiving (${archive.map(x => x.tag).join(', ')}). `
    + `Auto-archive is currently OFF — reply "enable archiving" to turn it on.`;
}

const timeStr = new Date().toLocaleTimeString('en-US', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
const title = `*🛡️ Sentinel Daily Briefing — ${inp.todayDate}*\n\n`;
const stamp = `\n\n_Generated at ${timeStr} Istanbul_`;

return [{ json: { text: title + briefing + footer + stamp, archivedCount, proposed: archive.length, enabled: ARCHIVE_ENABLED } }];
