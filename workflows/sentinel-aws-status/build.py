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
AWS_CRED = "ZTG1FO0pQaPremPm"          # eu-central-1 — for EC2 + regional-endpoint S3 calls
AWS_CRED_GLOBAL = "UbIpNHzRRRCB6Zuc"   # us-east-1 — IAM (and any true-global service) requires
                                        # this signing region regardless of resource location;
                                        # observed live: eu-central-1 credential got 403
                                        # SignatureDoesNotMatch against iam.amazonaws.com.
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

def http_aws(id_, name, method, url, pos, continue_on_fail=False, cred=AWS_CRED, cred_name="Sentinel AWS Status"):
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
    n = {"id": id_, "name": name, "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2,
         "position": pos, "credentials": {"aws": {"id": cred, "name": cred_name}},
         "parameters": p}
    if continue_on_fail:
        n["continueOnFail"] = True
        n["onError"] = "continueRegularOutput"
    return n

def xml_node(id_, name, pos):
    return {"id": id_, "name": name, "type": "n8n-nodes-base.xml", "typeVersion": 1,
            "position": pos, "parameters": {"dataPropertyName": "data", "options": {}}}

UPSERT_3 = ("INSERT INTO aws_status (id, ec2_summary, s3_summary, iam_summary, refreshed_at) "
            "VALUES (1, $1::jsonb, $2::jsonb, $3::jsonb, now()) "
            "ON CONFLICT (id) DO UPDATE SET ec2_summary=EXCLUDED.ec2_summary, s3_summary=EXCLUDED.s3_summary, "
            "iam_summary=EXCLUDED.iam_summary, refreshed_at=now();")
UPSERT_3_P = ("={{ [JSON.stringify($('Extract EC2 Summary').first().json.ec2_summary), "
              "JSON.stringify($('Aggregate S3 Summary').first().json.s3_summary), "
              "JSON.stringify($('Aggregate IAM Summary').first().json.iam_summary)] }}")

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
    # n8n's AWS SigV4 signer uses the credential's configured region for every call — the
    # generic global s3.amazonaws.com endpoint needs us-east-1 signing and 400s otherwise.
    # Using the regional endpoint keeps this consistent with the credential (eu-central-1).
    http_aws("s3-list", "List S3 Buckets", "GET", "https://s3.eu-central-1.amazonaws.com/", [260, 300]),
    xml_node("s3-list-xml", "Bucket List XML to JSON", [500, 300]),
    code("s3-names", "Extract Bucket Names", "extract-bucket-names.js", [740, 300]),
    # Runs once per item automatically (n8n's standard per-item fan-out) — no explicit loop
    # node needed for ~10 buckets. Most calls 404 (no PAB config) or region-mismatch (the one
    # us-east-1 bucket); onError keeps those from killing the other buckets' checks.
    http_aws("s3-pab", "Get Public Access Block", "GET",
             "=https://s3.eu-central-1.amazonaws.com/{{ $json.name }}?publicAccessBlock",
             [980, 300], continue_on_fail=True),
    code("s3-flag", "Flag Bucket Exposure", "flag-bucket.js", [1220, 300]),
    code("s3-aggregate", "Aggregate S3 Summary", "aggregate-s3.js", [1460, 300]),
    http_aws("iam-list", "List IAM Users", "GET",
             "https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08", [260, 500],
             cred=AWS_CRED_GLOBAL, cred_name="Sentinel AWS Status (Global)"),
    code("iam-names", "Extract User Names", "extract-iam-users.js", [500, 500]),
    http_aws("iam-keys", "List Access Keys", "GET",
             "=https://iam.amazonaws.com/?Action=ListAccessKeys&Version=2010-05-08&UserName={{ encodeURIComponent($json.name) }}",
             [740, 500], cred=AWS_CRED_GLOBAL, cred_name="Sentinel AWS Status (Global)"),
    code("iam-stale", "Compute Key Staleness", "compute-key-staleness.js", [980, 500]),
    http_aws("iam-mfa", "List MFA Devices", "GET",
             "=https://iam.amazonaws.com/?Action=ListMFADevices&Version=2010-05-08&UserName={{ encodeURIComponent($json.name) }}",
             [1220, 500], cred=AWS_CRED_GLOBAL, cred_name="Sentinel AWS Status (Global)"),
    http_aws("iam-login", "Get Login Profile", "GET",
             "=https://iam.amazonaws.com/?Action=GetLoginProfile&Version=2010-05-08&UserName={{ encodeURIComponent($('Compute Key Staleness').item.json.name) }}",
             [1460, 500], continue_on_fail=True, cred=AWS_CRED_GLOBAL, cred_name="Sentinel AWS Status (Global)"),
    code("iam-flag", "Flag IAM User", "flag-iam-user.js", [1700, 500]),
    code("iam-aggregate", "Aggregate IAM Summary", "aggregate-iam.js", [1940, 500]),
    pg("store-status", "Store AWS Status", UPSERT_3, UPSERT_3_P, [2180, 300]),
]

connections = {
    "Hourly": {"main": [[{"node": "Describe EC2 Instances", "type": "main", "index": 0},
                          {"node": "List S3 Buckets", "type": "main", "index": 0},
                          {"node": "List IAM Users", "type": "main", "index": 0}]]},
    "AWS Status Test Trigger": {"main": [[{"node": "Describe EC2 Instances", "type": "main", "index": 0},
                                           {"node": "List S3 Buckets", "type": "main", "index": 0},
                                           {"node": "List IAM Users", "type": "main", "index": 0}]]},
    "Describe EC2 Instances": {"main": [[{"node": "EC2 XML to JSON", "type": "main", "index": 0}]]},
    "EC2 XML to JSON": {"main": [[{"node": "Extract EC2 Summary", "type": "main", "index": 0}]]},
    "List S3 Buckets": {"main": [[{"node": "Bucket List XML to JSON", "type": "main", "index": 0}]]},
    "Bucket List XML to JSON": {"main": [[{"node": "Extract Bucket Names", "type": "main", "index": 0}]]},
    "Extract Bucket Names": {"main": [[{"node": "Get Public Access Block", "type": "main", "index": 0}]]},
    "Get Public Access Block": {"main": [[{"node": "Flag Bucket Exposure", "type": "main", "index": 0}]]},
    "Flag Bucket Exposure": {"main": [[{"node": "Aggregate S3 Summary", "type": "main", "index": 0}]]},
    "List IAM Users": {"main": [[{"node": "Extract User Names", "type": "main", "index": 0}]]},
    "Extract User Names": {"main": [[{"node": "List Access Keys", "type": "main", "index": 0}]]},
    "List Access Keys": {"main": [[{"node": "Compute Key Staleness", "type": "main", "index": 0}]]},
    "Compute Key Staleness": {"main": [[{"node": "List MFA Devices", "type": "main", "index": 0}]]},
    "List MFA Devices": {"main": [[{"node": "Get Login Profile", "type": "main", "index": 0}]]},
    "Get Login Profile": {"main": [[{"node": "Flag IAM User", "type": "main", "index": 0}]]},
    "Flag IAM User": {"main": [[{"node": "Aggregate IAM Summary", "type": "main", "index": 0}]]},
    "Aggregate IAM Summary": {"main": [[{"node": "Store AWS Status", "type": "main", "index": 0}]]},
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
time.sleep(40)

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
