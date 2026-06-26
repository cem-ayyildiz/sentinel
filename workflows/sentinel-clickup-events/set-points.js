// Parse the LLM's number, set it as ClickUp story points, and emit a ledger row.
const CK = '__CLICKUP_API_KEY__';
const o = $input.first().json; const text = o.text || o.output || '';
const m = text.match(/\b(1|2|3|5|8|13)\b/);
const sp = m ? parseInt(m[1],10) : (parseInt((text.match(/\d+/)||['3'])[0],10) || 3);
const src = $('Build SP Prompt').first().json; const tid = src.task_id;
try { await this.helpers.httpRequest({ method:'PUT', url:`https://api.clickup.com/api/v2/task/${tid}`, headers:{ Authorization: CK, 'Content-Type':'application/json' }, body:{ points: sp }, json:true }); } catch(e) {}
return [{ json: { task_id: tid, task_name: src.task_name||null, org: src.org||'freshsens', list_id:null, list_name:null, event:'sentinel_estimate', field:'agent_points_est', before_val:null, after_val:String(sp), assignee_user:null, points:sp, actor:'sentinel', event_time:new Date().toISOString(), raw:{ est:sp } } }];
