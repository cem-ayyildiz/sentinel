import requests, time
K="__N8N_API_KEY__"
B="https://flow.gohm.tech"; H={"X-N8N-API-KEY":K,"Content-Type":"application/json"}; PG="1TBwe9uebXBQKUhV"
S="/tmp/sentinel/"; js=lambda f: open(S+f).read()
UPSERT=("INSERT INTO decisions (signal_id, verdict, reason, raw_input, decided_via, decided_at) "
 "SELECT id, $2, $3, $4, $5, now() FROM signals WHERE slack_ts = $1 "
 "ON CONFLICT (signal_id) DO UPDATE SET "
 "verdict=COALESCE(EXCLUDED.verdict, decisions.verdict), "
 "reason=COALESCE(EXCLUDED.reason, decisions.reason), "
 "raw_input=COALESCE(EXCLUDED.raw_input, decisions.raw_input), "
 "decided_via=EXCLUDED.decided_via, decided_at=now() RETURNING signal_id, verdict, reason;")
UP_P="={{ [$json.ts, $json.verdict, $json.reason, $json.raw, $json.via] }}"
def code(i,n,f,p): return {"id":i,"name":n,"type":"n8n-nodes-base.code","typeVersion":2,"position":p,"parameters":{"jsCode":js(f)}}
nodes=[
 {"id":"wh","name":"Slack Events","type":"n8n-nodes-base.webhook","typeVersion":2,"position":[0,150],
  "webhookId":"sentinel-slack-events","parameters":{"path":"sentinel-slack-events","httpMethod":"POST","responseMode":"responseNode"}},
 code("route","Route Event","dc_route.js",[220,150]),
 {"id":"resp","name":"Respond","type":"n8n-nodes-base.respondToWebhook","typeVersion":1.1,"position":[440,150],
  "parameters":{"respondWith":"text","responseBody":"={{ $json.mode === 'challenge' ? $json.challenge : 'ok' }}","options":{}}},
 code("verdict","Map Verdict","dc_verdict.js",[660,40]),
 code("rprompt","Build Reply Prompt","dc_reply_prompt.js",[660,260]),
 {"id":"rllm","name":"Reply LLM","type":"@n8n/n8n-nodes-langchain.chainLlm","typeVersion":1.4,"position":[880,260],
  "parameters":{"promptType":"define","text":"={{ $json.prompt }}"}},
 {"id":"model","name":"Claude Model","type":"@chrishdx/n8n-nodes-claude-cli.lmChatClaudeCli","typeVersion":1,"position":[880,440],
  "parameters":{"model":"claude-sonnet-4-6","conversationMode":"stateless","options":{"maxTokensToSample":400}},
  "credentials":{"claudeCliApi":{"id":"xEpaYqT9ncGcZwHj","name":"Tunahan Chatbot · Claude CLI"}}},
 code("rparse","Parse Reply","dc_reply_parse.js",[1100,260]),
 {"id":"upsert","name":"Upsert Decision","type":"n8n-nodes-base.postgres","typeVersion":2.6,"position":[1320,150],
  "credentials":{"postgres":{"id":PG,"name":"Sentinel Postgres"}},
  "parameters":{"operation":"executeQuery","query":UPSERT,"options":{"queryReplacement":UP_P}}},
]
conns={
 "Slack Events":{"main":[[{"node":"Route Event","type":"main","index":0}]]},
 "Route Event":{"main":[[{"node":"Respond","type":"main","index":0}]]},
 "Respond":{"main":[[{"node":"Map Verdict","type":"main","index":0},{"node":"Build Reply Prompt","type":"main","index":0}]]},
 "Map Verdict":{"main":[[{"node":"Upsert Decision","type":"main","index":0}]]},
 "Build Reply Prompt":{"main":[[{"node":"Reply LLM","type":"main","index":0}]]},
 "Claude Model":{"ai_languageModel":[[{"node":"Reply LLM","type":"ai_languageModel","index":0}]]},
 "Reply LLM":{"main":[[{"node":"Parse Reply","type":"main","index":0}]]},
 "Parse Reply":{"main":[[{"node":"Upsert Decision","type":"main","index":0}]]},
}
wf={"name":"Sentinel · Decision Capture","nodes":nodes,"connections":conns,
    "settings":{"saveManualExecutions":True,"saveDataSuccessExecution":"all","saveDataErrorExecution":"all","executionTimeout":120,"timezone":"UTC"},"staticData":None}
ex=[w for w in requests.get(f"{B}/api/v1/workflows?limit=100",headers=H).json()["data"] if w["name"]=="Sentinel · Decision Capture"]
wid=ex[0]["id"]; requests.put(f"{B}/api/v1/workflows/{wid}",headers=H,json=wf); print("updated DC",wid)
requests.post(f"{B}/api/v1/workflows/{wid}/deactivate",headers=H); time.sleep(1)
print("DC active:", requests.post(f"{B}/api/v1/workflows/{wid}/activate",headers=H).json().get("active"))

# patch briefing queue node (top-level)
wf2=requests.get(f"{B}/api/v1/workflows/UR3IjaOiHX0guopW",headers=H).json()
for n in wf2["nodes"]:
    if n["name"]=="Post Decision Queue": n["parameters"]["jsCode"]=js("dq_post.js")
requests.put(f"{B}/api/v1/workflows/UR3IjaOiHX0guopW",headers=H,json={"name":wf2["name"],"nodes":wf2["nodes"],"connections":wf2["connections"],"settings":wf2["settings"],"staticData":None})
requests.post(f"{B}/api/v1/workflows/UR3IjaOiHX0guopW/deactivate",headers=H); time.sleep(1)
print("briefing active:", requests.post(f"{B}/api/v1/workflows/UR3IjaOiHX0guopW/activate",headers=H).json().get("active"))
