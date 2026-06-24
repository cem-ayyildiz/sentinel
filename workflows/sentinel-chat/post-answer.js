const ans = $input.first().json.text || $input.first().json.output || '(no answer)';
const TOKEN = '__SLACK_BOT_TOKEN__'; const CH = 'D0BBRKKPGUE';
await this.helpers.httpRequest({ method:'POST', url:'https://slack.com/api/chat.postMessage',
  headers:{ Authorization:`Bearer ${TOKEN}`, 'Content-Type':'application/json' }, body:{ channel:CH, text:`💬 ${ans}`, unfurl_links:false }, json:true });
return [{ json: { ok:true } }];
