const j = $input.first().json;
if (j.mode !== 'reaction') return [];
const ok = { white_check_mark:1, heavy_check_mark:1, '+1':1 };
const no = { x:1, no_entry_sign:1, wastebasket:1, '-1':1 };
let approved = null;
if (ok[j.reaction]) approved = true; else if (no[j.reaction]) approved = false; else return [];
return [{ json: { ts: j.ts, approved } }];
