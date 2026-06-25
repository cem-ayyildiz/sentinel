// If the LLM proposed a ClickUp action, execute it; strip the json from the answer.
const raw = $input.first().json.text || $input.first().json.output || '';
const CK = '__CLICKUP_API_KEY__';
const listMap = { freshsens: '901524068347', gohm: '901524068348', diefi: '1000360000000408' };
let prose = raw, action = null;
const m = raw.match(/```json\s*([\s\S]*?)```/i);
if (m) { try { action = JSON.parse(m[1].trim()); } catch (e) {} prose = raw.replace(m[0], '').trim(); }
let extra = '';
if (action && action.action === 'create_task' && action.title) {
  const list = listMap[action.org] || listMap.freshsens;
  const desc = `${action.description || ''}${action.assignee ? `\n\nSuggested assignee: ${action.assignee}` : ''}\n\n_(created by Sentinel chat for Cem)_`;
  try {
    const r = await this.helpers.httpRequest({ method: 'POST', url: `https://api.clickup.com/api/v2/list/${list}/task`,
      headers: { Authorization: CK, 'Content-Type': 'application/json' }, body: { name: action.title, description: desc }, json: true });
    extra = `\n\n✅ *Created in ClickUp* (${action.org}): <${r.url}|${action.title}>`;
  } catch (e) { extra = `\n\n⚠️ Couldn't create the task: ${e.message}`; }
}
return [{ json: { text: prose + extra } }];
