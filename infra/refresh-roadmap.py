# Scan the Miro roadmap board and print the 2026 goal items (feed into the roadmap table).
import json, urllib.request, re
MIRO="__MIRO_TOKEN__"; BID="uXjVLxVQ_qI%3D"
def get(url): return json.load(urllib.request.urlopen(urllib.request.Request(url,headers={"Authorization":f"Bearer {MIRO}"})))
strip=lambda h: re.sub(r"\s+"," ",re.sub(r"<[^>]+>"," ",h or "")).strip()
# frame ids via cursor
fid={}; url=f"https://api.miro.com/v2/boards/{BID}/items?type=frame&limit=50"
while url:
    d=get(url)
    for f in d.get("data",[]): fid[f["id"]]=f.get("data",{}).get("title") or "(untitled)"
    nxt=d.get("links",{}).get("next"); url=nxt if nxt and nxt!=url else None
want={i for i,t in fid.items() if t in ("Frame 1","hh","SMART Agile Product Roadmap")}
out=[]; url=f"https://api.miro.com/v2/boards/{BID}/items?limit=50"
while url:
    d=get(url)
    for it in d.get("data",[]):
        if (it.get("parent") or {}).get("id") in want:
            c=strip(it.get("data",{}).get("content"))
            if c and len(c)>30: out.append(c)
    nxt=d.get("links",{}).get("next"); url=nxt if nxt and nxt!=url else None
# dedupe
seen=set(); uniq=[c for c in out if not (c[:60] in seen or seen.add(c[:60]))]
print(json.dumps(uniq, ensure_ascii=False, indent=1))
