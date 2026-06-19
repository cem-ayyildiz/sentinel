import json, requests, time

N8N_KEY = "__N8N_API_KEY__"
WF_ID = "UR3IjaOiHX0guopW"
BASE = "https://flow.gohm.tech"
HEADERS = {"X-N8N-API-KEY": N8N_KEY, "Content-Type": "application/json"}
WEBHOOK_ID = "sentinel-test-trigger-001"

collector = open('/tmp/collector.js').read()
build_prompt = open('/tmp/build_prompt.js').read()
format_msg = open('/tmp/format_msg.js').read()
slack_send = open('/tmp/slack_send.js').read()

date_code = """const now = new Date();
const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const yesterday = new Date(todayUTC); yesterday.setDate(yesterday.getDate() - 1);
const tomorrow = new Date(todayUTC); tomorrow.setDate(tomorrow.getDate() + 1);
const yesterdayDate = yesterday.toISOString().split('T')[0];
const todayDate = todayUTC.toISOString().split('T')[0];
return [{ json: {
  yesterdayStart: yesterday.toISOString(),
  todayStart: todayUTC.toISOString(),
  todayEnd: tomorrow.toISOString(),
  yesterdayGmail: yesterdayDate.replace(/-/g, '/'),
  todayGmail: todayDate.replace(/-/g, '/'),
  todayDate, yesterdayDate
}}];"""

nodes = [
    {"id": "trigger-001", "name": "Daily 07:00 Istanbul", "type": "n8n-nodes-base.scheduleTrigger",
     "typeVersion": 1.2, "position": [0, 200],
     "parameters": {"rule": {"interval": [{"field": "cronExpression", "expression": "0 4 * * *"}]}}},
    {"id": "webhook-test", "name": "Webhook Test Trigger", "type": "n8n-nodes-base.webhook",
     "typeVersion": 2, "position": [0, 400], "webhookId": WEBHOOK_ID,
     "parameters": {"path": WEBHOOK_ID, "httpMethod": "GET", "responseMode": "onReceived"}},
    {"id": "code-dates", "name": "Set Date Range", "type": "n8n-nodes-base.code",
     "typeVersion": 2, "position": [260, 300], "parameters": {"jsCode": date_code}},
    {"id": "collect-all", "name": "Collect All Sources", "type": "n8n-nodes-base.code",
     "typeVersion": 2, "position": [520, 300], "parameters": {"jsCode": collector}},
    {"id": "build-prompt", "name": "Build AI Prompt", "type": "n8n-nodes-base.code",
     "typeVersion": 2, "position": [780, 300], "parameters": {"jsCode": build_prompt}},
    {"id": "claude-chain", "name": "Claude: Synthesize", "type": "@n8n/n8n-nodes-langchain.chainLlm",
     "typeVersion": 1.4, "position": [1040, 300],
     "parameters": {"promptType": "define", "text": "={{ $json.prompt }}"}},
    {"id": "claude-model", "name": "Claude Model", "type": "@chrishdx/n8n-nodes-claude-cli.lmChatClaudeCli",
     "typeVersion": 1, "position": [1040, 500],
     "parameters": {"model": "claude-sonnet-4-6", "conversationMode": "stateless", "options": {"maxTokensToSample": 2200}},
     "credentials": {"claudeCliApi": {"id": "xEpaYqT9ncGcZwHj", "name": "Tunahan Chatbot · Claude CLI"}}},
    {"id": "format-msg", "name": "Format Message", "type": "n8n-nodes-base.code",
     "typeVersion": 2, "position": [1300, 300], "parameters": {"jsCode": format_msg}},
    {"id": "slack-send", "name": "Send to Cem", "type": "n8n-nodes-base.code",
     "typeVersion": 2, "position": [1560, 300], "parameters": {"jsCode": slack_send}},
]

connections = {
    "Daily 07:00 Istanbul": {"main": [[{"node": "Set Date Range", "type": "main", "index": 0}]]},
    "Webhook Test Trigger": {"main": [[{"node": "Set Date Range", "type": "main", "index": 0}]]},
    "Set Date Range": {"main": [[{"node": "Collect All Sources", "type": "main", "index": 0}]]},
    "Collect All Sources": {"main": [[{"node": "Build AI Prompt", "type": "main", "index": 0}]]},
    "Build AI Prompt": {"main": [[{"node": "Claude: Synthesize", "type": "main", "index": 0}]]},
    "Claude Model": {"ai_languageModel": [[{"node": "Claude: Synthesize", "type": "ai_languageModel", "index": 0}]]},
    "Claude: Synthesize": {"main": [[{"node": "Format Message", "type": "main", "index": 0}]]},
    "Format Message": {"main": [[{"node": "Send to Cem", "type": "main", "index": 0}]]},
}

settings = {"saveExecutionProgress": True, "saveManualExecutions": True, "saveDataErrorExecution": "all",
            "saveDataSuccessExecution": "all", "executionTimeout": 3600, "timezone": "UTC"}

payload = {"name": "Sentinel · Daily Briefing", "nodes": nodes, "connections": connections,
           "settings": settings, "staticData": None}

r = requests.put(f"{BASE}/api/v1/workflows/{WF_ID}", headers=HEADERS, json=payload)
print("Update:", r.status_code)
if r.status_code != 200:
    print(r.text[:500]); exit(1)

requests.post(f"{BASE}/api/v1/workflows/{WF_ID}/deactivate", headers=HEADERS)
time.sleep(1)
act = requests.post(f"{BASE}/api/v1/workflows/{WF_ID}/activate", headers=HEADERS)
print("Activate:", act.status_code, act.json().get("active"), act.json().get("message", "")[:200])

if not act.json().get("active"):
    exit(1)

time.sleep(3)
wh = requests.get(f"{BASE}/webhook/{WEBHOOK_ID}", timeout=30)
print("Webhook:", wh.status_code)
print("Waiting for collection + AI synthesis (~90s)...")
time.sleep(90)

execs = requests.get(f"{BASE}/api/v1/executions?workflowId={WF_ID}&limit=1", headers=HEADERS).json()
ex = execs["data"][0] if execs.get("data") else {}
exec_id, status = ex.get("id"), ex.get("status")
print(f"Execution: {exec_id} | status: {status}")

if exec_id:
    detail = requests.get(f"{BASE}/api/v1/executions/{exec_id}?includeData=true", headers=HEADERS).json()
    run_data = detail.get('data', {}).get('resultData', {}).get('runData', {})
    for node, runs in run_data.items():
        for run in runs:
            if run.get('error'):
                print(f"  ERROR [{node}]: {run['error'].get('message','')[:250]}")
            else:
                out = run.get('data', {}).get('main', [[]])
                cnt = sum(len(b) for b in out if b)
                print(f"  OK [{node}]: {cnt} items")
                if node == 'Send to Cem' and out and out[0]:
                    print(f"     -> {out[0][0].get('json', {})}")
