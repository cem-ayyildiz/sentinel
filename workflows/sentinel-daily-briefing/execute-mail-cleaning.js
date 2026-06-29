// ===== Assemble Briefing — formerly "Execute Mail Cleaning" =====
// Auto-archiving has been RETIRED: Cem curates his own inbox now, so Sentinel never moves mail.
// This node simply wraps the analyst's prose with a title + timestamp for delivery/storage.
// (Node name kept as "Execute Mail Cleaning" so downstream references stay valid.)
const inp = $input.first().json;
const briefing = inp.briefing || '';

const timeStr = new Date().toLocaleTimeString('en-US', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
const title = `*🛡️ Sentinel Daily Briefing — ${inp.todayDate}*\n\n`;
const stamp = `\n\n_Generated at ${timeStr} Istanbul_`;

return [{ json: { text: title + briefing + stamp, archivedCount: 0, proposed: 0, enabled: false } }];
