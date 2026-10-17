#!/usr/bin/env python3
"""Publish store-isolated, documented retailer prices to Supabase via service role.

Run ONLY on CI/server. Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set as
GitHub Actions secrets, never in client apps. Do not upload estimated prices here.

Lidl: official permanent-assortment NATIONAL prices; no individual stock data.
Kaufland: public WEEKLY OFFERS for unspecified default selected store;
          do NOT label them exact prices for a chosen physical branch.
"""
import json,os,re,sys,time
from pathlib import Path
from datetime import datetime,timezone,date
import requests

ROOT=Path(__file__).resolve().parents[1]
URL=os.environ.get("SUPABASE_URL","").rstrip("/")
KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY","")
if not URL.startswith("https://") or not KEY:
    raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secrets.")
if not re.fullmatch(r"https://[a-z0-9.-]+\.supabase\.co",URL):
    raise SystemExit("SUPABASE_URL must be a hosted Supabase project URL")

HTTP=requests.Session()
HTTP.headers.update({
    "apikey":KEY,
    "Authorization":"Bearer "+KEY,
    "Content-Type":"application/json",
    "Prefer":"resolution=merge-duplicates,return=representation"
})

def send(table,rows,conflict,batch=100):
    result=[]
    for start in range(0,len(rows),batch):
        subset=rows[start:start+batch]
        target=f"{URL}/rest/v1/{table}"
        params={"on_conflict":conflict}
        for attempt in range(4):
            r=HTTP.post(target,params=params,json=subset,timeout=60)
            if r.status_code in (429,500,502,503,504):
                time.sleep(2**attempt);continue
            if not r.ok:
                raise RuntimeError(f"{table} HTTP {r.status_code}: {r.text[:700]}")
            result.extend(r.json())
            break
        else:raise RuntimeError("Repeated database upload errors")
    return result

def read_feed(path,retailer,max_age_hours):
    p=json.loads((ROOT/path).read_text(encoding="utf-8"))
    meta=p.get("meta") or {}
    checked=meta.get("checked_at")
    if not checked:raise RuntimeError(f"No checked_at for {retailer}")
    stamp=datetime.fromisoformat(checked.replace("Z","+00:00"))
    age=(datetime.now(timezone.utc)-stamp).total_seconds()/3600
    if age< -2 or age>max_age_hours:raise RuntimeError(f"Stale {retailer} feed, age {age:.1f}h; not publishing")
    if not isinstance(p.get("products"),list) or len(p["products"])<20:
        raise RuntimeError(f"Unexpectedly small {retailer} catalog")
    return p,stamp.date().isoformat()

def parse_pack(s):
    # If the source doesn't unambiguously specify a package, preserve null.
    s=str(s or "").strip().lower().replace(" ","").replace(",",".")
    m=re.fullmatch(r"(\d+(?:\.\d+)?)(kg|g|l|ml|buc)",s)
    if not m:return None,None
    q=float(m[1]);unit=m[2]
    if q<=0:return None,None
    if unit=="kg":return q*1000,"g"
    if unit=="l":return q*1000,"ml"
    return q,unit

def publish_lidl():
    feed,day=read_feed(Path("docs/api/lidl/lidl_products.json"),"lidl",max_age_hours=100)
    records=[];prices=[]
    for obj in feed["products"]:
        x=obj.get("price_ron")
        if not isinstance(x,(int,float)) or x<=0:continue
        qty,unit=parse_pack(obj.get("size"))
        eid=str(obj["id"])
        records.append({"store_id":"lidl","location_code":"national","external_id":eid,
          "name":str(obj["name"]).strip(),"pack_amount":qty,"pack_unit":unit,
          "category":obj.get("category"),"image_url":None,"active":True})
        prices.append((eid,float(x),obj))
    uploaded=send("products",records,"store_id,location_code,external_id")
    ids={x["external_id"]:x["id"] for x in uploaded}
    observations=[{"product_id":ids[eid],"store_id":"lidl","location_code":"national",
          "amount_ron":price,"source_kind":"lidl_official_list",
          "source_url":item.get("source_url"),"captured_on":day,
          "price_scope":"national","membership_required":False}
        for eid,price,item in prices if eid in ids]
    send("product_prices",observations,
         "product_id,captured_on,amount_ron,source_kind,membership_required")
    print(f"Lidl: {len(observations)} documented prices (national permanent catalog)")

def publish_kaufland():
    feed,day=read_feed(Path("docs/api/kaufland/kaufland_offers.json"),"kaufland",max_age_hours=60)
    records=[];prices=[]
    today=date.today()
    for obj in feed["products"]:
        price=obj.get("price_ron")
        if not isinstance(price,(float,int)) or price<=0:continue
        try:from_day=date.fromisoformat(obj["valid_from"]);to_day=date.fromisoformat(obj["valid_to"])
        except (ValueError,KeyError):continue
        if not from_day<=today<=to_day:continue
        qty,unit=parse_pack(obj.get("size"))
        eid=str(obj["id"])
        records.append({"store_id":"kaufland","location_code":"site_default",
          "external_id":eid,"name":str(obj["name"]).strip(),"pack_amount":qty,
          "pack_unit":unit,"category":obj.get("category"),"image_url":obj.get("image_url"),
          "active":True})
        prices.append((eid,float(price),obj))
    if len(records)<20:raise RuntimeError("Too few currently active Kaufland offers")
    uploaded=send("products",records,"store_id,location_code,external_id")
    ids={x["external_id"]:x["id"] for x in uploaded}
    observations=[{"product_id":ids[eid],"store_id":"kaufland",
          "location_code":"site_default","amount_ron":price,
          "source_kind":"kaufland_public_offer","source_url":item.get("source_url"),
          "captured_on":day,"valid_from":item.get("valid_from"),"valid_to":item.get("valid_to"),
          "price_scope":"site_default","membership_required":bool(item.get("membership_required",False))}
        for eid,price,item in prices if eid in ids]
    send("product_prices",observations,
         "product_id,captured_on,amount_ron,source_kind,membership_required")
    print(f"Kaufland: {len(observations)} public offers, default site location (NOT all shelf prices)")

if __name__=="__main__":
    publish_lidl()
    publish_kaufland()
