const response = $input.first().json;
const promptData = $('Build AI Prompt').first().json;
const content = response.text || response.output || response.content?.[0]?.text || 'Error: no AI response received';
const timeStr = new Date().toLocaleTimeString('en-US', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
const text = `*🛡️ Sentinel Daily Briefing — ${promptData.todayDate}*\n\n${content}\n\n_Generated at ${timeStr} Istanbul_`;
return [{ json: { text } }];
