import requests, time
K="__N8N_API_KEY__"
B="https://flow.gohm.tech"; H={"X-N8N-API-KEY":K,"Content-Type":"application/json"}; PG="1TBwe9uebXBQKUhV"
S="/tmp/sentinel/"; js=lambda f: open(S+f).read()
LOAD_PROFILE="SELECT profile FROM decision_profile ORDER BY updated_at DESC LIMIT 1;"
# type='task' (overdue ClickUp tasks) deliberately EXCLUDED from queue candidates — Cem tracks
# ClickUp himself (feedback 2026-07-02: no DM triage pings for overdue tasks; the briefing's
# ⏳ Overdue section is the only place they surface). Task signals still land in `signals`.
LOAD_CAND=("SELECT id, type, org, title, body, actor, url, metadata FROM signals "
 "WHERE ingested_at >= date_trunc('day', now()) AND slack_ts IS NULL "
 "AND id NOT IN (SELECT signal_id FROM decisions WHERE signal_id IS NOT NULL) "
 "AND type='email' AND COALESCE((metadata->>'automated')::boolean,false)=false AND COALESCE((metadata->>'bulk')::boolean,false)=false "
 "ORDER BY CASE WHEN COALESCE((metadata->>'unread')::boolean,false) THEN 0 ELSE 1 END, ingested_at DESC LIMIT 15;")
AUTO_SKIP="INSERT INTO decisions (signal_id, verdict, reason, decided_via) VALUES ($1,'skip',$2,'auto_rule') ON CONFLICT (signal_id) DO NOTHING;"
AUTO_SKIP_P="={{ [$json.id, 'auto-skipped (learned rule)' + ($json.hint ? (' — '+$json.hint) : '')] }}"
UPTS="UPDATE signals SET slack_ts=$1 WHERE id=$2;"
def pg(i,n,q,p,pos):
    par={"operation":"executeQuery","query":q,"options":{}}
    if p: par["options"]["queryReplacement"]=p
    return {"id":i,"name":n,"type":"n8n-nodes-base.postgres","typeVersion":2.6,"position":pos,"credentials":{"postgres":{"id":PG,"name":"Sentinel Postgres"}},"parameters":par}
def code(i,n,f,pos): return {"id":i,"name":n,"type":"n8n-nodes-base.code","typeVersion":2,"position":pos,"parameters":{"jsCode":js(f)}}
nodes=[
 {"id":"wh","name":"Go","type":"n8n-nodes-base.webhook","typeVersion":2,"position":[0,150],
  "webhookId":"sentinel-postqueue","parameters":{"path":"sentinel-postqueue","httpMethod":"GET","responseMode":"onReceived"}},
 pg("prof","Load Profile",LOAD_PROFILE,None,[200,150]),
 pg("cand","Load Candidates",LOAD_CAND,None,[400,150]),
 code("pcp","Pre-Classify Prompt","pc_prompt.js",[600,150]),
 {"id":"pcllm","name":"Pre-Classify LLM","type":"@n8n/n8n-nodes-langchain.chainLlm","typeVersion":1.4,"position":[800,150],"parameters":{"promptType":"define","text":"={{ $json.prompt }}"}},
 {"id":"model","name":"Claude Model","type":"@chrishdx/n8n-nodes-claude-cli.lmChatClaudeCli","typeVersion":1,"position":[800,330],
  "parameters":{"model":"claude-sonnet-4-6","conversationMode":"stateless","options":{"maxTokensToSample":800}},"credentials":{"claudeCliApi":{"id":"xEpaYqT9ncGcZwHj","name":"Tunahan Chatbot · Claude CLI"}}},
 code("pcparse","Parse Classification","pc_parse.js",[1000,150]),
 code("fskip","Filter AutoSkip","filter_autoskip.js",[1200,40]),
 pg("recskip","Auto-Record Skips",AUTO_SKIP,AUTO_SKIP_P,[1400,40]),
 code("fsurf","Filter Surface","filter_surface.js",[1200,260]),
 code("post","Post Surfaced","dq_post_hint.js",[1400,260]),
 pg("upts","Update Slack TS",UPTS,"={{ [$json.ts, $json.id] }}",[1600,260]),
]
conns={
 "Go":{"main":[[{"node":"Load Profile","type":"main","index":0}]]},
 "Load Profile":{"main":[[{"node":"Load Candidates","type":"main","index":0}]]},
 "Load Candidates":{"main":[[{"node":"Pre-Classify Prompt","type":"main","index":0}]]},
 "Pre-Classify Prompt":{"main":[[{"node":"Pre-Classify LLM","type":"main","index":0}]]},
 "Claude Model":{"ai_languageModel":[[{"node":"Pre-Classify LLM","type":"ai_languageModel","index":0}]]},
 "Pre-Classify LLM":{"main":[[{"node":"Parse Classification","type":"main","index":0}]]},
 "Parse Classification":{"main":[[{"node":"Filter AutoSkip","type":"main","index":0},{"node":"Filter Surface","type":"main","index":0}]]},
 "Filter AutoSkip":{"main":[[{"node":"Auto-Record Skips","type":"main","index":0}]]},
 "Filter Surface":{"main":[[{"node":"Post Surfaced","type":"main","index":0}]]},
 "Post Surfaced":{"main":[[{"node":"Update Slack TS","type":"main","index":0}]]},
}
wf={"name":"Sentinel · Post Queue (manual)","nodes":nodes,"connections":conns,
 "settings":{"saveManualExecutions":True,"saveDataSuccessExecution":"all","saveDataErrorExecution":"all","executionTimeout":180,"timezone":"UTC"},"staticData":None}
wid=[w for w in requests.get(f"{B}/api/v1/workflows?limit=100",headers=H).json()["data"] if w["name"]==wf["name"]][0]["id"]
requests.put(f"{B}/api/v1/workflows/{wid}",headers=H,json=wf)
requests.post(f"{B}/api/v1/workflows/{wid}/deactivate",headers=H); time.sleep(1)
print("Post Queue active:", requests.post(f"{B}/api/v1/workflows/{wid}/activate",headers=H).json().get("active"), "id", wid)
