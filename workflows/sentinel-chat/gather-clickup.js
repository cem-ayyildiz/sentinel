const CK = '__CLICKUP_API_KEY__';
const teams = [['9009068877','FreshSens'],['42085420','GOHM'],['9014647941','DIEFI']];
const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
const out = []; const taskIndex = [];
for (const [tid, name] of teams) {
  try {
    const sp = await this.helpers.httpRequest({ method:'GET', url:`https://api.clickup.com/api/v2/team/${tid}/space?archived=false`, headers:{Authorization:CK} });
    const spd = typeof sp==='string'?JSON.parse(sp):sp; const smap={}; (spd.spaces||[]).forEach(s=>{smap[s.id]=s.name;});
    const r = await this.helpers.httpRequest({ method:'GET', url:`https://api.clickup.com/api/v2/team/${tid}/task?date_updated_gt=${cutoff}&order_by=updated&subtasks=true&include_closed=true&page=0`, headers:{Authorization:CK} });
    const d = typeof r==='string'?JSON.parse(r):r; const tasks=d.tasks||[];
    const byPerson={};
    for (const t of tasks) {
      const sname=smap[(t.space||{}).id]||'?'; const st=(t.status||{}).status||'?';
      const done=((t.status||{}).type==='closed'||(t.status||{}).type==='done');
      if (taskIndex.length<60) taskIndex.push({ id:t.id, name:(t.name||'').substring(0,50), org:name });
      (t.assignees||[]).forEach(a=>{ byPerson[a.username]=byPerson[a.username]||[];
        if(byPerson[a.username].length<10) byPerson[a.username].push(`${done?'✓':'•'} ${(t.name||'').substring(0,48)} [${sname}/${st}]`); });
    }
    out.push({org:name, totalUpdated:tasks.length, people:byPerson});
  } catch (e) { out.push({org:name, error:e.message}); }
}
return [{ json: { clickup: out, taskIndex } }];
