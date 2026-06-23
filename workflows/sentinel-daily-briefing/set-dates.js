const now = new Date();
const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const yesterday = new Date(todayUTC); yesterday.setDate(yesterday.getDate() - 1);
const tomorrow = new Date(todayUTC); tomorrow.setDate(tomorrow.getDate() + 1);
const yesterdayDate = yesterday.toISOString().split('T')[0];
const todayDate = todayUTC.toISOString().split('T')[0];
return [{ json: {
  yesterdayStart: yesterday.toISOString(),
  todayStart: todayUTC.toISOString(),
  todayEnd: tomorrow.toISOString(),
  yesterdayGmail: yesterdayDate.replace(/-/g, '/'),
  todayGmail: todayDate.replace(/-/g, '/'),
  todayDate, yesterdayDate
}}];