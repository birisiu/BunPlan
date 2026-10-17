#!/usr/bin/env python3
"""Authorized Glovo Partner API full vendor catalog importer.
No scraping, and Glovo checkout/reference prices are NOT physical Kaufland shelf prices.
Requires authorization to view the specific Kaufland vendor/chain.
"""
import os,json,time,datetime,hashlib,re
from pathlib import Path
import requests

API="https://glovo.partner.deliveryhero.io/v2"
ROOT=Path(__file__).resolve().parents[1]
REQUIRED=["GLOVO_CLIENT_ID","GLOVO_CLIENT_SECRET","GLOVO_CHAIN_ID","GLOVO_VENDOR_ID"]
AVOID=re.compile(r"(tutun|tobacco|alcool|alcohol|vinuri|wines|detergent|cleaning|cosmetic|personal care|pet shop|petshop|jucarii|household|baterii|toys)",re.I)

def get_token(session):
    r=session.post(API+"/oauth/token",data={"grant_type":"client_credentials",
           "client_id":os.environ["GLOVO_CLIENT_ID"],
           "client_secret":os.environ["GLOVO_CLIENT_SECRET"]},timeout=35)
    r.raise_for_status()
    token=r.json().get("access_token")
    if not token:raise RuntimeError("No access token returned; cannot sync")
    return token
def is_food(p):
    categories=p.get("categories",[])
    names=[]
    for item in categories:
        if isinstance(item,dict):
            names += list((item.get("details") or {}).get("name",{}).values())
            names += [item.get("name","")]
    title=str(p.get("title") or "")
    if AVOID.search(" ".join(map(str,names))+" "+title):return False
    return True
def import_catalog(session,token,chain,vendor,page_size=500):
    url=f"{API}/chains/{chain}/vendors/{vendor}/catalog"
    records={};expected_pages=None
    for page in range(1,200):
        for attempt in range(5):
            r=session.get(url,headers={"Authorization":"Bearer "+token},
                params={"page":page,"page_size":page_size,"is_active":"true"},timeout=45)
            if r.status_code==429 or r.status_code>=500:
                time.sleep(min(15,2**attempt));continue
            r.raise_for_status();break
        else:raise RuntimeError("Catalog API consistently unavailable; previous snapshot unchanged")
        payload=r.json()
        if expected_pages is None:
            expected_pages=int(payload.get("total_pages") or 0)
            if not expected_pages or expected_pages>199:raise RuntimeError("Invalid total_pages")
        if int(payload.get("total_pages"))!=expected_pages:raise RuntimeError("Catalog pagination changed during export")
        page_products=payload.get("products")
        if not isinstance(page_products,list):raise RuntimeError("No products list")
        for item in page_products:
            if not is_food(item):continue
            sku=str(item.get("sku") or item.get("remote_product_id") or "")
            title=str(item.get("title") or "").strip()
            try:price=round(float(item["price"]),2)
            except (TypeError,KeyError,ValueError):continue
            if not sku or not title or price<=0 or price>100000:continue
            rid="kaufland-glovo-"+hashlib.sha256((vendor+"|"+sku).encode()).hexdigest()[:20]
            images=item.get("images") or []
            cats=item.get("categories") or []
            records[rid]={"id":rid,"store":"Kaufland","delivery_platform":"Glovo",
                "vendor_id":vendor,"name":title,"sku":sku,"barcodes":item.get("barcodes") or [],
                "price_ron":price,"currency":"RON","image_url":images[0] if images else None,
                "category_ids":[c.get("global_id") for c in cats if isinstance(c,dict)],
                "price_kind":"glovo_reference_not_shelf","stock_status":"delivery_catalog_active",
                "source_url":"https://glovoapp.com/ro/ro/bucharest/stores/kaufland-buc"}
        if page==expected_pages:break
        time.sleep(.25)
    if len(records)<100:raise RuntimeError("Too few products; refusing to publish")
    return {"meta":{"store":"Kaufland","source":"Glovo Partner Catalog API",
        "price_kind":"delivery_reference_not_physical_shelf_price",
        "vendor_id":vendor,"chain_id":chain,"products_count":len(records),
        "retrieved_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "complete_pages":expected_pages},
        "products":sorted(records.values(),key=lambda p:p["name"].lower())}

def main():
    missing=[v for v in REQUIRED if not os.environ.get(v)]
    if missing:raise SystemExit("Authorized credentials required: "+",".join(missing))
    with requests.Session() as session:
        token=get_token(session)
        payload=import_catalog(session,token,os.environ["GLOVO_CHAIN_ID"],os.environ["GLOVO_VENDOR_ID"])
    dest=ROOT/"data"/"partner"
    dest.mkdir(parents=True,exist_ok=True)
    filename=dest/"kaufland_glovo_authorized.json"
    filename.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print("Imported authorized vendor products:",payload["meta"]["products_count"])
if __name__=="__main__":main()
