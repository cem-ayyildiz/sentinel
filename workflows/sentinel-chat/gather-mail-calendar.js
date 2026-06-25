// Live email (both inboxes, last 3 days) + calendar (next 7 days) for the chatbot.
const FS = { id: '836787456970-1rrue4ph9lhv0gesi8mq2i0auhppbkev.apps.googleusercontent.com', secret: '__GOOGLE_CLIENT_SECRET__' };
const GOHM = { id: '623417040507-4pe98u0bsd3tdrdgiclch6ad0ioprkbr.apps.googleusercontent.com', secret: '__GOOGLE_CLIENT_SECRET__' };
const RT = {
  fsGmail: '__GOOGLE_REFRESH_TOKEN__',
  fsCal:   '__GOOGLE_REFRESH_TOKEN__',
  gohmGmail: '__GOOGLE_REFRESH_TOKEN__',
  gohmCal: '__GOOGLE_REFRESH_TOKEN__',
};
const gtok = async (cid, sec, rt) => {
  const r = await this.helpers.httpRequest({ method:'POST', url:'https://oauth2.googleapis.com/token', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:`client_id=${cid}&client_secret=${sec}&refresh_token=${encodeURIComponent(rt)}&grant_type=refresh_token` });
  return (typeof r==='string'?JSON.parse(r):r).access_token;
};
const hdr = (m,n)=>{ const h=(m.payload?.headers||[]).find(x=>x.name===n); return h?h.value:''; };
const emails = async (cid,sec,rt)=>{
  const t=await gtok(cid,sec,rt);
  const l=await this.helpers.httpRequest({method:'GET',url:`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=12&q=${encodeURIComponent('in:inbox newer_than:3d')}`,headers:{Authorization:`Bearer ${t}`}});
  const ld=typeof l==='string'?JSON.parse(l):l; const ids=(ld.messages||[]).map(m=>m.id);
  const ms=await Promise.all(ids.map(id=>this.helpers.httpRequest({method:'GET',url:`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,headers:{Authorization:`Bearer ${t}`}}).then(r=>typeof r==='string'?JSON.parse(r):r).catch(()=>null)));
  return ms.filter(Boolean).map(m=>({from:hdr(m,'From'),subject:hdr(m,'Subject'),snippet:(m.snippet||'').substring(0,120)}));
};
const events = async (cid,sec,rt,cal)=>{
  const t=await gtok(cid,sec,rt); const now=new Date().toISOString(); const wk=new Date(Date.now()+7*864e5).toISOString();
  const r=await this.helpers.httpRequest({method:'GET',url:`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal)}/events?timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(wk)}&singleEvents=true&orderBy=startTime&maxResults=20`,headers:{Authorization:`Bearer ${t}`}});
  const d=typeof r==='string'?JSON.parse(r):r;
  return (d.items||[]).map(e=>({summary:e.summary||'',start:(e.start?.dateTime||e.start?.date||'').substring(0,16),attendees:(e.attendees||[]).map(a=>a.email).slice(0,6).join(', ')})).filter(e=>e.summary);
};
const out={emailsFs:[],emailsGohm:[],calFs:[],calGohm:[]};
try{out.emailsFs=await emails(FS.id,FS.secret,RT.fsGmail);}catch(e){}
try{out.emailsGohm=await emails(GOHM.id,GOHM.secret,RT.gohmGmail);}catch(e){}
try{out.calFs=await events(FS.id,FS.secret,RT.fsCal,'ca@freshsens.ai');}catch(e){}
try{out.calGohm=await events(GOHM.id,GOHM.secret,RT.gohmCal,'cem.ayyildiz@gohm.tech');}catch(e){}
return [{ json: { mailcal: out } }];
