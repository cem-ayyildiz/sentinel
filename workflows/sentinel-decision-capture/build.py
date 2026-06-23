import requests, time, json
N8N_KEY="__N8N_API_KEY__"
B="https://flow.gohm.tech"; H={"X-N8N-API-KEY":N8N_KEY,"Content-Type":"application/json"}; PG="1TBwe9uebXBQKUhV"
S="/tmp/sentinel/"
route=open(S+"dc_route.js").read(); verdict=open(S+"dc_verdict.js").read()
INS=("INSERT INTO decisions (signal_id, verdict, decided_via) "
     "SELECT id, $2, 'slack_reaction' FROM signals WHERE slack_ts = $1 RETURNING signal_id, verdict;")
nodes=[
 {"id":"wh","name":"Slack Events","type":"n8n-nodes-base.webhook","typeVersion":2,"position":[0,0],
  "webhookId":"sentinel-slack-events","parameters":{"path":"sentinel-slack-events","httpMethod":"POST","responseMode":"responseNode"}},
 {"id":"route","name":"Route Event","type":"n8n-nodes-base.code","typeVersion":2,"position":[230,0],"parameters":{"jsCode":route}},
 {"id":"resp","name":"Respond","type":"n8n-nodes-base.respondToWebhook","typeVersion":1.1,"position":[460,0],
  "parameters":{"respondWith":"text","responseBody":"={{ $json.mode === 'challenge' ? $json.challenge : 'ok' }}","options":{}}},
 {"id":"verdict","name":"Map Verdict","type":"n8n-nodes-base.code","typeVersion":2,"position":[690,0],"parameters":{"jsCode":verdict}},
 {"id":"ins","name":"Insert Decision","type":"n8n-nodes-base.postgres","typeVersion":2.6,"position":[920,0],
  "credentials":{"postgres":{"id":PG,"name":"Sentinel Postgres"}},
  "parameters":{"operation":"executeQuery","query":INS,"options":{"queryReplacement":"={{ [$json.ts, $json.verdict] }}"}}},
]
conns={
 "Slack Events":{"main":[[{"node":"Route Event","type":"main","index":0}]]},
 "Route Event":{"main":[[{"node":"Respond","type":"main","index":0}]]},
 "Respond":{"main":[[{"node":"Map Verdict","type":"main","index":0}]]},
 "Map Verdict":{"main":[[{"node":"Insert Decision","type":"main","index":0}]]},
}
wf={"name":"Sentinel · Decision Capture","nodes":nodes,"connections":conns,
    "settings":{"saveManualExecutions":True,"saveDataSuccessExecution":"all","saveDataErrorExecution":"all","executionTimeout":60,"timezone":"UTC"},"staticData":None}
# create or update if exists
existing=[w for w in requests.get(f"{B}/api/v1/workflows?limit=100",headers=H).json()["data"] if w["name"]=="Sentinel · Decision Capture"]
if existing:
    wid=existing[0]["id"]; requests.put(f"{B}/api/v1/workflows/{wid}",headers=H,json=wf); print("updated",wid)
else:
    r=requests.post(f"{B}/api/v1/workflows",headers=H,json=wf); wid=r.json().get("id"); print("created",r.status_code,wid)
requests.post(f"{B}/api/v1/workflows/{wid}/activate",headers=H); time.sleep(2)
open("/tmp/sentinel/dc_wid.txt","w").write(wid)

# TEST 1: url_verification challenge
chal=requests.post(f"{B}/webhook/sentinel-slack-events",json={"type":"url_verification","challenge":"abc123test"},timeout=20)
print("challenge resp:", chal.status_code, repr(chal.text[:60]))
print("PRODUCTION URL: https://flow.gohm.tech/webhook/sentinel-slack-events")
