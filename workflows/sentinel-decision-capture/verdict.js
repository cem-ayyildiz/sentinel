// Map reaction emoji -> verdict (decision taxonomy). Unmapped/non-reaction -> drop.
const j = $input.first().json;
if (j.mode !== 'reaction') return [];
const map = {
  white_check_mark:'do_now', heavy_check_mark:'do_now', '+1':'do_now',
  clock3:'do_later', hourglass:'do_later', hourglass_flowing_sand:'do_later', alarm_clock:'do_later',
  bust_in_silhouette:'delegate_person', busts_in_silhouette:'delegate_person',
  robot_face:'delegate_agent', robot:'delegate_agent',
  eyes:'watch', eye:'watch',
  wastebasket:'skip', no_entry_sign:'skip', x:'skip', '-1':'skip',
};
const verdict = map[j.reaction];
if (!verdict) return [];
return [{ json: { ts: j.ts, verdict, reaction: j.reaction } }];
