import json, os, time, requests

with open('/home/cem/.claude.json') as f:
    _cfg = json.load(f)
N8N_KEY = _cfg['mcpServers']['n8n']['env']['N8N_API_KEY']
B = "https://flow.gohm.tech"
H = {
    "X-N8N-API-KEY": N8N_KEY,
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
}
PG = "1TBwe9uebXBQKUhV"
AWS_CRED = "ZTG1FO0pQaPremPm"
NAME = "Sentinel · AWS Status"
TEST_PATH = "sentinel-aws-status-test"

HERE = os.path.dirname(os.path.abspath(__file__))
def js(f): return open(os.path.join(HERE, f)).read()

def code(id_, name, f, pos):
    return {"id": id_, "name": name, "type": "n8n-nodes-base.code", "typeVersion": 2,
            "position": pos, "parameters": {"jsCode": js(f)}}

def pg(id_, name, query, params, pos):
    p = {"operation": "executeQuery", "query": query, "options": {}}
    if params:
        p["options"]["queryReplacement"] = params
    return {"id": id_, "name": name, "type": "n8n-nodes-base.postgres", "typeVersion": 2.6,
            "position": pos, "credentials": {"postgres": {"id": PG, "name": "Sentinel Postgres"}},
            "parameters": p}

def http_aws(id_, name, method, url, pos):
    # Query string embedded directly in `url` (not via sendQuery/queryParameters) — n8n's
    # AWS SigV4 signer appears to sign before queryParameters get merged in, dropping them
    # from the actual wire request (observed live: AWS returned MissingAction even though
    # the params were present in the node's request config). Embedding in the URL avoids
    # that ordering issue entirely.
    p = {
        "method": method,
        "url": url,
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "aws",
        "options": {"response": {"response": {"responseFormat": "text"}}},
    }
    return {"id": id_, "name": name, "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2,
            "position": pos, "credentials": {"aws": {"id": AWS_CRED, "name": "Sentinel AWS Status"}},
            "parameters": p}

def xml_node(id_, name, pos):
    return {"id": id_, "name": name, "type": "n8n-nodes-base.xml", "typeVersion": 1,
            "position": pos, "parameters": {"dataPropertyName": "data", "options": {}}}

UPSERT_EC2 = ("INSERT INTO aws_status (id, ec2_summary, refreshed_at) VALUES (1, $1::jsonb, now()) "
              "ON CONFLICT (id) DO UPDATE SET ec2_summary=EXCLUDED.ec2_summary, refreshed_at=now();")
UPSERT_EC2_P = "={{ [JSON.stringify($json.ec2_summary || $json)] }}"

nodes = [
    {"id": "trig", "name": "Hourly", "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2,
     "position": [0, 0], "parameters": {"rule": {"interval": [{"field": "cronExpression", "expression": "0 * * * *"}]}}},
    {"id": "wht", "name": "AWS Status Test Trigger", "type": "n8n-nodes-base.webhook", "typeVersion": 2,
     "position": [0, 200], "parameters": {"path": TEST_PATH, "httpMethod": "GET", "responseMode": "onReceived"}},
    http_aws("ec2-describe", "Describe EC2 Instances", "GET",
             "https://ec2.eu-central-1.amazonaws.com/?Action=DescribeInstances&Version=2016-11-15",
             [260, 100]),
    xml_node("ec2-xml", "EC2 XML to JSON", [500, 100]),
    code("ec2-extract", "Extract EC2 Summary", "extract-ec2.js", [740, 100]),
    pg("store-status", "Store AWS Status", UPSERT_EC2, UPSERT_EC2_P, [980, 100]),
]

connections = {
    "Hourly": {"main": [[{"node": "Describe EC2 Instances", "type": "main", "index": 0}]]},
    "AWS Status Test Trigger": {"main": [[{"node": "Describe EC2 Instances", "type": "main", "index": 0}]]},
    "Describe EC2 Instances": {"main": [[{"node": "EC2 XML to JSON", "type": "main", "index": 0}]]},
    "EC2 XML to JSON": {"main": [[{"node": "Extract EC2 Summary", "type": "main", "index": 0}]]},
    "Extract EC2 Summary": {"main": [[{"node": "Store AWS Status", "type": "main", "index": 0}]]},
}

settings = {"saveManualExecutions": True, "saveDataSuccessExecution": "all",
            "saveDataErrorExecution": "all", "executionTimeout": 300, "timezone": "UTC"}

wf = {"name": NAME, "nodes": nodes, "connections": connections, "settings": settings, "staticData": None}

existing = [w for w in requests.get(f"{B}/api/v1/workflows?limit=100", headers=H, timeout=30).json()["data"] if w["name"] == NAME]
if existing:
    wid = existing[0]["id"]
    r = requests.put(f"{B}/api/v1/workflows/{wid}", headers=H, json=wf, timeout=30)
    print("updated", wid, r.status_code, r.text[:300] if r.status_code != 200 else "")
else:
    r = requests.post(f"{B}/api/v1/workflows", headers=H, json=wf, timeout=30)
    wid = r.json().get("id")
    print("created", r.status_code, wid, r.text[:300] if r.status_code not in (200, 201) else "")

if not wid:
    raise SystemExit(1)

requests.post(f"{B}/api/v1/workflows/{wid}/deactivate", headers=H, timeout=30)
time.sleep(1)
act = requests.post(f"{B}/api/v1/workflows/{wid}/activate", headers=H, timeout=30)
print("active:", act.json().get("active"), "| id:", wid)
time.sleep(2)

fire = requests.get(f"{B}/webhook/{TEST_PATH}", timeout=30)
print("fire:", fire.status_code)
time.sleep(10)

ex = requests.get(f"{B}/api/v1/executions?workflowId={wid}&limit=1", headers=H, timeout=30).json()["data"][0]
print("execution:", ex["id"], ex["status"])
det = requests.get(f"{B}/api/v1/executions/{ex['id']}?includeData=true", headers=H, timeout=30).json()
rd = det["data"]["resultData"].get("runData", {})
for node, runs in rd.items():
    for i, run in enumerate(runs):
        if run.get("error"):
            print(f"  ERROR [{node}] run{i}:", json.dumps(run["error"])[:500])
        else:
            out = run.get("data", {}).get("main", [[]])
            for batch in out:
                for item in (batch or []):
                    print(f"  OK [{node}] run{i}:", json.dumps(item.get("json", {}))[:2000])
