const now = new Date();
const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const yesterday = new Date(todayUTC); yesterday.setDate(yesterday.getDate() - 1);
const tomorrow = new Date(todayUTC); tomorrow.setDate(tomorrow.getDate() + 1);
const yesterdayDate = yesterday.toISOString().split('T')[0];
const todayDate = todayUTC.toISOString().split('T')[0];

// Istanbul-local weekday (cron runs 04:00 UTC = 07:00 IST, so +3h keeps us on the same date).
const ist = new Date(now.getTime() + 3 * 3600 * 1000);
const weekday = ist.getUTCDay();                       // 0=Sun … 5=Fri … 6=Sat
const DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const isFriday = weekday === 5;
const isMonday = weekday === 1;
// Monday 00:00 of the current ISO week (Istanbul), for the weekly story-point window.
const daysSinceMon = (weekday + 6) % 7;
const weekStart = new Date(todayUTC); weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMon);
const weekAgo = new Date(todayUTC); weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);

return [{ json: {
  yesterdayStart: yesterday.toISOString(),
  todayStart: todayUTC.toISOString(),
  todayEnd: tomorrow.toISOString(),
  yesterdayGmail: yesterdayDate.replace(/-/g, '/'),
  todayGmail: todayDate.replace(/-/g, '/'),
  todayDate, yesterdayDate,
  weekday, weekdayName: DOW[weekday], isFriday, isMonday,
  weekStart: weekStart.toISOString(), weekAgo: weekAgo.toISOString(),
}}];