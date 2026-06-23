import requests, time
N8N_KEY = "__N8N_API_KEY__"
BASE = "https://flow.gohm.tech"; H = {"X-N8N-API-KEY": N8N_KEY, "Content-Type": "application/json"}
WF_ID = "UR3IjaOiHX0guopW"; WEBHOOK_ID = "sentinel-test-trigger-001"; PG = "1TBwe9uebXBQKUhV"
S = "/tmp/sentinel/"
def js(f): return open(S + f).read()

INSERT_SIG = ("INSERT INTO signals (source, source_ref, org, type, title, body, actor, url, metadata, content_hash) "
              "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) ON CONFLICT (content_hash) DO NOTHING;")
INSERT_SIG_P = "={{ [$json.source, $json.source_ref, $json.org, $json.type, $json.title, $json.body, $json.actor, $json.url, JSON.stringify($json.metadata||{}), $json.content_hash] }}"

LOAD_CTX = (
  "SELECT "
  "(SELECT profile FROM decision_profile ORDER BY updated_at DESC LIMIT 1) AS profile, "
  "(SELECT COALESCE(json_agg(row_to_json(t)),'[]'::json) FROM ("
  "  SELECT s.title, s.source, s.type, s.org, d.verdict, d.reason "
  "  FROM decisions d JOIN signals s ON s.id=d.signal_id "
  "  ORDER BY d.decided_at DESC LIMIT 200) t) AS recent_decisions, "
  "(SELECT row_to_json(b) FROM ("
  "  SELECT prose, open_issues, briefing_date FROM briefings ORDER BY created_at DESC LIMIT 1) b) AS last_briefing;")

STORE_BRIEF = "INSERT INTO briefings (briefing_date, prose, open_issues) VALUES ($1::date, $2, $3::jsonb);"
STORE_BRIEF_P = ("={{ [$('Build Analyst Prompt').first().json.todayDate, "
                 "$('Execute Mail Cleaning').first().json.text, "
                 "JSON.stringify($('Parse Analyst Output').first().json.openIssues||[]) ] }}")

LOAD_QUEUE = (
  "SELECT id, type, org, title, actor, url, metadata FROM signals "
  "WHERE ingested_at >= date_trunc('day', now()) AND slack_ts IS NULL AND ("
  "  (type='email' AND COALESCE((metadata->>'automated')::boolean,false)=false "
  "                AND COALESCE((metadata->>'bulk')::boolean,false)=false) "
  "  OR type='task') "
  "ORDER BY CASE WHEN type='email' AND COALESCE((metadata->>'unread')::boolean,false) THEN 0 "
  "              WHEN type='task' THEN 1 ELSE 2 END, ingested_at DESC LIMIT 10;")
UPDATE_TS = "UPDATE signals SET slack_ts=$1 WHERE id=$2;"
UPDATE_TS_P = "={{ [$json.ts, $json.id] }}"

def code(id_, name, f, pos): return {"id":id_,"name":name,"type":"n8n-nodes-base.code","typeVersion":2,"position":pos,"parameters":{"jsCode":js(f)}}
def pg(id_, name, query, params, pos):
    p = {"operation":"executeQuery","query":query,"options":{}}
    if params: p["options"]["queryReplacement"] = params
    return {"id":id_,"name":name,"type":"n8n-nodes-base.postgres","typeVersion":2.6,"position":pos,
            "credentials":{"postgres":{"id":PG,"name":"Sentinel Postgres"}},"parameters":p}

nodes = [
 {"id":"trigger-001","name":"Daily 07:00 Istanbul","type":"n8n-nodes-base.scheduleTrigger","typeVersion":1.2,
  "position":[0,200],"parameters":{"rule":{"interval":[{"field":"cronExpression","expression":"0 4 * * *"}]}}},
 {"id":"webhook-test","name":"Webhook Test Trigger","type":"n8n-nodes-base.webhook","typeVersion":2,
  "position":[0,400],"webhookId":WEBHOOK_ID,"parameters":{"path":WEBHOOK_ID,"httpMethod":"GET","responseMode":"onReceived"}},
 code("code-dates","Set Date Range","set_dates.js",[240,300]),
 code("collect-all","Collect All Sources","collector.js",[470,300]),
 code("emit-sig","Emit Signals","emit_signals.js",[700,120]),
 pg("insert-sig","Insert Signals",INSERT_SIG,INSERT_SIG_P,[930,120]),
 pg("load-queue","Load Decision Queue",LOAD_QUEUE,None,[1160,120]),
 code("post-queue","Post Decision Queue","dq_post.js",[1390,120]),
 pg("update-ts","Update Slack TS",UPDATE_TS,UPDATE_TS_P,[1620,120]),
 pg("load-ctx","Load Context",LOAD_CTX,None,[700,420]),
 code("build-prompt","Build Analyst Prompt","build_prompt.js",[930,420]),
 {"id":"claude-chain","name":"Sentinel Analyst","type":"@n8n/n8n-nodes-langchain.chainLlm","typeVersion":1.4,
  "position":[1160,420],"parameters":{"promptType":"define","text":"={{ $json.prompt }}"}},
 {"id":"claude-model","name":"Claude Model","type":"@chrishdx/n8n-nodes-claude-cli.lmChatClaudeCli","typeVersion":1,
  "position":[1160,620],"parameters":{"model":"claude-sonnet-4-6","conversationMode":"stateless","options":{"maxTokensToSample":3000}},
  "credentials":{"claudeCliApi":{"id":"xEpaYqT9ncGcZwHj","name":"Tunahan Chatbot · Claude CLI"}}},
 code("parse-output","Parse Analyst Output","parse_output.js",[1390,420]),
 code("execute-cleaning","Execute Mail Cleaning","execute_cleaning.js",[1620,420]),
 code("slack-send","Send to Cem","slack_send.js",[1850,540]),
 pg("store-brief","Store Briefing",STORE_BRIEF,STORE_BRIEF_P,[1850,320]),
]

connections = {
 "Daily 07:00 Istanbul":{"main":[[{"node":"Set Date Range","type":"main","index":0}]]},
 "Webhook Test Trigger":{"main":[[{"node":"Set Date Range","type":"main","index":0}]]},
 "Set Date Range":{"main":[[{"node":"Collect All Sources","type":"main","index":0}]]},
 "Collect All Sources":{"main":[[{"node":"Emit Signals","type":"main","index":0},{"node":"Load Context","type":"main","index":0}]]},
 "Emit Signals":{"main":[[{"node":"Insert Signals","type":"main","index":0}]]},
 "Insert Signals":{"main":[[{"node":"Load Decision Queue","type":"main","index":0}]]},
 "Load Decision Queue":{"main":[[{"node":"Post Decision Queue","type":"main","index":0}]]},
 "Post Decision Queue":{"main":[[{"node":"Update Slack TS","type":"main","index":0}]]},
 "Load Context":{"main":[[{"node":"Build Analyst Prompt","type":"main","index":0}]]},
 "Build Analyst Prompt":{"main":[[{"node":"Sentinel Analyst","type":"main","index":0}]]},
 "Claude Model":{"ai_languageModel":[[{"node":"Sentinel Analyst","type":"ai_languageModel","index":0}]]},
 "Sentinel Analyst":{"main":[[{"node":"Parse Analyst Output","type":"main","index":0}]]},
 "Parse Analyst Output":{"main":[[{"node":"Execute Mail Cleaning","type":"main","index":0}]]},
 "Execute Mail Cleaning":{"main":[[{"node":"Send to Cem","type":"main","index":0},{"node":"Store Briefing","type":"main","index":0}]]},
}

settings = {"saveExecutionProgress":True,"saveManualExecutions":True,"saveDataErrorExecution":"all",
            "saveDataSuccessExecution":"all","executionTimeout":3600,"timezone":"UTC"}
payload = {"name":"Sentinel · Daily Briefing","nodes":nodes,"connections":connections,"settings":settings,"staticData":None}

r = requests.put(f"{BASE}/api/v1/workflows/{WF_ID}", headers=H, json=payload)
print("Update:", r.status_code, r.text[:300] if r.status_code!=200 else "")
if r.status_code!=200: exit(1)
requests.post(f"{BASE}/api/v1/workflows/{WF_ID}/deactivate", headers=H); time.sleep(1)
act = requests.post(f"{BASE}/api/v1/workflows/{WF_ID}/activate", headers=H)
print("Activate:", act.status_code, act.json().get("active"), act.json().get("message","")[:200])
if not act.json().get("active"): exit(1)
time.sleep(3)
wh = requests.get(f"{BASE}/webhook/{WEBHOOK_ID}", timeout=30); print("Webhook:", wh.status_code)
print("Waiting ~120s for full pipeline..."); time.sleep(120)
ex = requests.get(f"{BASE}/api/v1/executions?workflowId={WF_ID}&limit=1", headers=H).json()["data"][0]
print("Execution:", ex["id"], "| status:", ex["status"])
det = requests.get(f"{BASE}/api/v1/executions/{ex['id']}?includeData=true", headers=H).json()
rd = det["data"]["resultData"].get("runData",{})
for node, runs in rd.items():
    run = runs[0]
    if run.get("error"): print(f"  ERROR [{node}]:", run["error"].get("message","")[:200])
    else:
        out = run.get("data",{}).get("main",[[]]); cnt = sum(len(b) for b in out if b)
        print(f"  OK [{node}]: {cnt}")
