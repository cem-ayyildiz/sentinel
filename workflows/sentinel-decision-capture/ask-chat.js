const j = $input.first().json;
if (j.mode !== 'question') return [];
try {
  await this.helpers.httpRequest({ method:'POST', url:'https://flow.gohm.tech/webhook/sentinel-chat',
    headers:{ 'Content-Type':'application/json' }, body:{ text: j.text }, json:true });
} catch (e) {}
return [{ json: { asked: true } }];
