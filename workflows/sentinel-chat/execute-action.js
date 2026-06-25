const raw = $input.first().json.text || $input.first().json.output || '';
const CK = '__CLICKUP_API_KEY__';
const listMap = { freshsens: '901524068347', gohm: '901524068348', diefi: '1000360000000408' };
let prose = raw, action = null;
const m = raw.match(/```json\s*([\s\S]*?)```/i);
if (m) { try { action = JSON.parse(m[1].trim()); } catch (e) {} prose = raw.replace(m[0], '').trim(); }
let extra = '';
const http = (opts) => this.helpers.httpRequest(opts);
try {
  if (action && action.action === 'create_task' && action.title) {
    const list = listMap[action.org] || listMap.freshsens;
    const desc = `${action.description || ''}${action.assignee ? `\n\nSuggested assignee: ${action.assignee}` : ''}\n\n_(created by Sentinel chat)_`;
    const r = await http({ method:'POST', url:`https://api.clickup.com/api/v2/list/${list}/task`, headers:{Authorization:CK,'Content-Type':'application/json'}, body:{name:action.title, description:desc}, json:true });
    extra = `\n\n✅ *Created in ClickUp* (${action.org}): <${r.url}|${action.title}>`;
  } else if (action && action.action === 'add_comment' && action.task_id && action.comment) {
    await http({ method:'POST', url:`https://api.clickup.com/api/v2/task/${action.task_id}/comment`, headers:{Authorization:CK,'Content-Type':'application/json'}, body:{comment_text:action.comment, notify_all:false}, json:true });
    extra = `\n\n✅ *Comment added* → <https://app.clickup.com/t/${action.task_id}|task ${action.task_id}>`;
  }
} catch (e) { extra = `\n\n⚠️ ClickUp action failed: ${e.message}`; }
return [{ json: { text: prose + extra } }];
