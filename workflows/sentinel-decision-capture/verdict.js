const j = $input.first().json;
if (j.mode !== 'reaction') return [];
const map = {
  white_check_mark:'do_now', heavy_check_mark:'do_now', '+1':'do_now',
  clock3:'do_later', hourglass:'do_later', hourglass_flowing_sand:'do_later', alarm_clock:'do_later',
  bust_in_silhouette:'delegate_person', busts_in_silhouette:'delegate_person',
  robot_face:'delegate_agent', robot:'delegate_agent', eyes:'watch', eye:'watch',
  wastebasket:'skip', no_entry_sign:'skip', x:'skip', '-1':'skip',
  checkered_flag:'done', ballot_box_with_check:'done', heavy_check_mark_2:'done', '100':'done',
};
const verdict = map[j.reaction];
if (!verdict) return [];
return [{ json: { ts: j.ts, verdict, reason: null, raw: null, via: 'slack_reaction' } }];
