#!/usr/bin/env python3
"""Public Kaufland Romania weekly-offers importer. Not permanent prices or store stock."""
import csv,hashlib,json,re,unicodedata
from datetime import date,datetime,timezone
from pathlib import Path
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup

SOURCE="https://www.kaufland.ro/oferte/prezentare-generala-oferte.html"
ROOT=Path(__file__).resolve().parents[1]
FOOD=("legume","fructe","carne","mezeluri","peste","lactate","oua","delicatese",
      "congelate","alimente de baza","brutarie","cafea","ceai","dulciuri","snackuri","bauturi")
ALCOHOL=re.compile(r"\b(?:bere|vin|wine|vodka|votca|vodca|whisk(?:e)?y|rom|bourbon|gin|lichior|tequila|prosecco|sampanie|cidru|brandy|cognac|alcool|pinot|merlot|chardonnay|feteasca|spumant|spirtoas[ae])\b",re.I)
SAFE_DRINK=re.compile(r"(apa |apă |suc |nectar|răcoritoare|racoritoare|limonad|cola|pepsi|ice tea|ceai|tonic|energizant|cappy|smoothie|fanta|sprite)",re.I)
def norm(s):
    s=unicodedata.normalize("NFKD",str(s or ""))
    return "".join(c for c in s if not unicodedata.combining(c)).lower().strip()
def food(cat,name):
    c,n=norm(cat),norm(name)
    if not any(x in c for x in FOOD) or ALCOHOL.search(n):return False
    if "bauturi" in c and (not SAFE_DRINK.search(n) or re.search(r"\b[1-9]\d?(?:[.,]\d+)?\s*%\s*(?:alc|vol)\b",n)):return False
    if "legume" in c and any(x in n for x in ("crizantem","flor","planta","bonsai","buchet","orhidee","ghiveci")):return False
    return True
def embedded(html):
    s=BeautifulSoup(html,"html.parser")
    for tag in s.find_all("script"):
        t=tag.string or tag.get_text() or ""
        if "window.SSR" not in t or "OfferTemplate" not in t:continue
        for m in re.finditer(r"window\.SSR\[[^]]+\]\s*=\s*",t):
            try:o,_=json.JSONDecoder().raw_decode(t[m.end():])
            except (ValueError,TypeError):continue
            if o.get("component")=="OfferTemplate" and o.get("props",{}).get("offerData"):
                return o["props"]
    raise RuntimeError("No public OfferTemplate JSON found; refusing to publish guessed prices")
def extract(html,today=None):
    today=today or date.today()
    props=embedded(html)
    found={};category_count=0
    for cycle in props.get("offerData",{}).get("cycles",[]):
        for cat in cycle.get("categories",[]):
            category_count+=1
            cn=str(cat.get("displayName") or cat.get("name") or "")
            for offer in cat.get("offers",[]):
                title=" ".join(str(v or "").strip() for v in (offer.get("title"),offer.get("subtitle"))).strip()
                if not food(cn,title):continue
                try:
                    start=date.fromisoformat(str(offer.get("dateFrom") or cat.get("dateFrom") or ""))
                    end=date.fromisoformat(str(offer.get("dateTo") or cat.get("dateTo") or ""))
                except ValueError:continue
                if not start<=today<=end:continue
                price=offer.get("price")
                if type(price) not in (float,int) or not 0<price<20000:continue
                oid=str(offer.get("offerId") or "").strip()
                if not oid:continue
                photo=offer.get("listImage")
                host=urlparse(str(photo or "")).hostname or ""
                photo=str(photo) if str(photo).startswith("https://") and host.endswith("kaufland.media.schwarz") else None
                card=("Kaufland Card XTRA" in cn or offer.get("loyaltyOnly") is True)
                pid="kaufland-"+hashlib.sha256(oid.encode()).hexdigest()[:20]
                found[pid]={
                  "id":pid,"store":"Kaufland","name":title,"size":str(offer.get("unit") or "").strip(),
                  "category":cn,"price_ron":round(float(price),2),"currency":"RON",
                  "image_url":photo,"source_url":SOURCE,
                  "valid_from":start.isoformat(),"valid_to":end.isoformat(),
                  "kind":"ofertă cu Kaufland Card XTRA" if card else "ofertă săptămânală",
                  "membership_required":card,"stock_status":"unknown","original_offer_id":oid}
    if len(found)<20:raise RuntimeError("Only "+str(len(found))+" current food offers from "+str(category_count)+" categories; no publish")
    now=datetime.now(timezone.utc).isoformat(timespec="seconds")
    return {"meta":{"store":"Kaufland Romania","checked_at":now,"product_count":len(found),
             "source_url":SOURCE,"price_scope":"weekly offers for the site's default selected store; not a national price list",
             "stock_available":False,"full_assortment":False,"promotions_included":True,
             "images_external":True}, "products":sorted(found.values(),key=lambda p:(norm(p["category"]),norm(p["name"])))}
def main():
    r=requests.get(SOURCE,timeout=45,headers={"User-Agent":"BunPlan/1.0 public weekly-offers import"})
    r.raise_for_status()
    if not 10000<len(r.content)<12000000:raise RuntimeError("Unexpected HTML response size")
    payload=extract(r.text)
    for dest in (ROOT/"data",ROOT/"docs"/"api"/"kaufland"):
        dest.mkdir(parents=True,exist_ok=True)
        (dest/"kaufland_offers.json").write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
        with (dest/"kaufland_offers.csv").open("w",newline="",encoding="utf-8-sig") as f:
            w=csv.DictWriter(f,fieldnames=list(payload["products"][0]))
            w.writeheader();w.writerows(payload["products"])
    print("Kaufland offers:",payload["meta"]["product_count"],"checked:",payload["meta"]["checked_at"])
if __name__=="__main__":main()
