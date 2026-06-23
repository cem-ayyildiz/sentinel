import requests, time
N8N_KEY="__N8N_API_KEY__"
B="https://flow.gohm.tech"; H={"X-N8N-API-KEY":N8N_KEY,"Content-Type":"application/json"}; PG="1TBwe9uebXBQKUhV"
S="/tmp/sentinel/"
pf_prompt=open(S+"pf_prompt.js").read(); pf_parse=open(S+"pf_parse.js").read()
LOAD=("SELECT s.title, s.source, s.type, s.org, s.actor, d.verdict, d.reason, d.delegate_to "
      "FROM decisions d JOIN signals s ON s.id=d.signal_id ORDER BY d.decided_at DESC LIMIT 500;")
STORE="INSERT INTO decision_profile (profile) VALUES ($1::jsonb);"
nodes=[
 {"id":"cron","name":"Weekly Sun 20:00","type":"n8n-nodes-base.scheduleTrigger","typeVersion":1.2,"position":[0,0],
  "parameters":{"rule":{"interval":[{"field":"cronExpression","expression":"0 17 * * 0"}]}}},
 {"id":"wht","name":"Profile Test Trigger","type":"n8n-nodes-base.webhook","typeVersion":2,"position":[0,200],
  "webhookId":"sentinel-profile-test","parameters":{"path":"sentinel-profile-test","httpMethod":"GET","responseMode":"onReceived"}},
 {"id":"load","name":"Load Decisions","type":"n8n-nodes-base.postgres","typeVersion":2.6,"position":[240,100],
  "credentials":{"postgres":{"id":PG,"name":"Sentinel Postgres"}},"parameters":{"operation":"executeQuery","query":LOAD,"options":{}}},
 {"id":"prompt","name":"Build Profile Prompt","type":"n8n-nodes-base.code","typeVersion":2,"position":[470,100],"parameters":{"jsCode":pf_prompt}},
 {"id":"chain","name":"Profile LLM","type":"@n8n/n8n-nodes-langchain.chainLlm","typeVersion":1.4,"position":[700,100],
  "parameters":{"promptType":"define","text":"={{ $json.prompt }}"}},
 {"id":"model","name":"Claude Model","type":"@chrishdx/n8n-nodes-claude-cli.lmChatClaudeCli","typeVersion":1,"position":[700,300],
  "parameters":{"model":"claude-sonnet-4-6","conversationMode":"stateless","options":{"maxTokensToSample":1500}},
  "credentials":{"claudeCliApi":{"id":"xEpaYqT9ncGcZwHj","name":"Tunahan Chatbot · Claude CLI"}}},
 {"id":"parse","name":"Parse Profile","type":"n8n-nodes-base.code","typeVersion":2,"position":[930,100],"parameters":{"jsCode":pf_parse}},
 {"id":"store","name":"Store Profile","type":"n8n-nodes-base.postgres","typeVersion":2.6,"position":[1160,100],
  "credentials":{"postgres":{"id":PG,"name":"Sentinel Postgres"}},
  "parameters":{"operation":"executeQuery","query":STORE,"options":{"queryReplacement":"={{ [JSON.stringify($json.profile)] }}"}}},
]
conns={
 "Weekly Sun 20:00":{"main":[[{"node":"Load Decisions","type":"main","index":0}]]},
 "Profile Test Trigger":{"main":[[{"node":"Load Decisions","type":"main","index":0}]]},
 "Load Decisions":{"main":[[{"node":"Build Profile Prompt","type":"main","index":0}]]},
 "Build Profile Prompt":{"main":[[{"node":"Profile LLM","type":"main","index":0}]]},
 "Claude Model":{"ai_languageModel":[[{"node":"Profile LLM","type":"ai_languageModel","index":0}]]},
 "Profile LLM":{"main":[[{"node":"Parse Profile","type":"main","index":0}]]},
 "Parse Profile":{"main":[[{"node":"Store Profile","type":"main","index":0}]]},
}
wf={"name":"Sentinel · Profile","nodes":nodes,"connections":conns,
    "settings":{"saveManualExecutions":True,"saveDataSuccessExecution":"all","saveDataErrorExecution":"all","executionTimeout":300,"timezone":"UTC"},"staticData":None}
existing=[w for w in requests.get(f"{B}/api/v1/workflows?limit=100",headers=H).json()["data"] if w["name"]=="Sentinel · Profile"]
if existing: wid=existing[0]["id"]; requests.put(f"{B}/api/v1/workflows/{wid}",headers=H,json=wf); print("updated",wid)
else: r=requests.post(f"{B}/api/v1/workflows",headers=H,json=wf); wid=r.json().get("id"); print("created",r.status_code,wid)
requests.post(f"{B}/api/v1/workflows/{wid}/activate",headers=H); time.sleep(2)
fire=requests.get(f"{B}/webhook/sentinel-profile-test",timeout=30); print("fire:",fire.status_code)
time.sleep(45)
ex=requests.get(f"{B}/api/v1/executions?workflowId={wid}&limit=1",headers=H).json()["data"][0]
print("exec:",ex["id"],ex["status"])
det=requests.get(f"{B}/api/v1/executions/{ex['id']}?includeData=true",headers=H).json()
rd=det["data"]["resultData"].get("runData",{})
for n in ["Load Decisions","Build Profile Prompt","Profile LLM","Parse Profile","Store Profile"]:
    if n in rd:
        r=rd[n][0]
        if r.get("error"): print(f"  {n}: ERR",r["error"].get("message","")[:150])
        else:
            out=r.get("data",{}).get("main",[[]]); 
            if n=="Parse Profile" and out and out[0]: print("  Parse Profile ->",out[0][0]["json"])
            else: print(f"  {n}: OK")
