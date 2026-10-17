#!/usr/bin/env python3
"""Imports Lidl Romania's public national permanent-assortment XLSB price list.
Does not provide local stock, promotions, photos or reuse rights."""
import csv,hashlib,io,json,re,unicodedata
from datetime import datetime,timezone
from pathlib import Path
import requests
from pyxlsb import open_workbook

SOURCE="https://www.lidl.ro/explore/assets/webPriceData/ro/preturiZilniceLidl.xlsb"
ROOT=Path(__file__).resolve().parents[1]
FOOD=("lactate","branz","legume","fructe","carne","peste","paine","patiserie",
      "cereale","paste","fainoase","orez","conserve","congelate","oua",
      "dulciuri","snack","cafea","ceai","bauturi","sosuri","condimente",
      "miere","gem","dulcet","proaspete","produse de baza","ulei",
      "unt","margarina","copt","supe","inghetata","mezeluri")
EXCLUDE=re.compile(
    r"\\b(bere|vin|wine|votca|vodca|vodka|whisky|whiskey|bourbon|brandy|"
    r"cognac|gin|rom|lichior|prosecco|sampanie|cidru|tequila|alcool|coniac|"
    r"merlot|chardonnay|pinot|feteasca|sauvignon|spumant|aperitiv|amaretto|"
    r"limoncello|limoncino|spirtoasa|spirtoasa|spirt)\\b",re.I)
# "Bauturi" also contains alcoholic drinks. Do not assume everything in it is food.
SAFE_DRINK_TERMS=("apa ","apa.","apa_","apa minerala","aqua ","suc ","suc de ","nectar",
                  "limonad","racoritoare","racorit.","baut.rac","baut. rac",
                  "cola","fanta","sprite","schweppes","tonic","ice tea","iced tea",
                  "ceai ","sirop ","smoothie","juice","energizant","energy drink",
                  "isotonic","zero zahar","fresh ","protein drink","whey drink",
                  "bautura fara alcool","bautura nealcoolica")
def norm(x):
    s=unicodedata.normalize("NFKD",str(x or ""))
    return " ".join("".join(c for c in s if not unicodedata.combining(c)).lower().split())
def numeric(x):
    try:
        s=str(x).strip().replace(" ","").replace("\u00a0","")
        if "," in s and "." in s:s=s.replace(".","").replace(",",".")
        else:s=s.replace(",",".")
        n=float(s)
        return round(n,2) if 0<n<100000 else None
    except (ValueError,TypeError):return None
def main():
    r=requests.get(SOURCE,timeout=50,headers={"User-Agent":"BunPlan/1.0 public price import"})
    r.raise_for_status()
    if not r.content.startswith(b"PK") or len(r.content)>20000000:raise RuntimeError("Unexpected workbook response")
    with open_workbook(io.BytesIO(r.content)) as book:
        sheet="EPEL" if "EPEL" in book.sheets else book.sheets[0]
        with book.get_sheet(sheet) as sh:
            rows=([c.v for c in row] for row in sh.rows(sparse=False))
            header=None;products={};conflicts={};headers_seen=0
            for line in rows:
                normalized=[norm(x) for x in line]
                if header is None:
                    headers_seen+=1
                    get=lambda opts:next((i for i,s in enumerate(normalized) if any(s==o or s.startswith(o+" ") for o in opts)),None)
                    cols={
                        "name":get(("denumire comerciala","denumire produs","denumire","produs")),
                        "size":get(("gramaj","cantitate","ambalaj")),
                        "category":get(("categorie","categoria","grupa")),
                        "price":get(("pret vanzare","pret de vanzare","pret","pret ron"))
                    }
                    if all(v is not None for v in cols.values()):header=cols
                    elif headers_seen>75:raise RuntimeError("Lidl sheet headers changed; keeping older catalog")
                    continue
                try:
                    name=str(line[header["name"]] or "").strip()
                    size=str(line[header["size"]] or "").strip()
                    cat=str(line[header["category"]] or "").strip()
                    price=numeric(line[header["price"]])
                except IndexError:continue
                nc=norm(cat)
                if not name or not price or not any(word in nc for word in FOOD) or EXCLUDE.search(norm(name)):continue
                if nc=="bauturi":
                    nn=norm(name)
                    if not any(term in nn for term in SAFE_DRINK_TERMS) or re.search(
                        r"\\b[1-9][0-9]?(?:[.,][0-9]+)?\\s*%\\s*(?:alc|vol)",nn):
                        continue
                key=norm(name)+"|"+norm(size).replace(" ","")+"|"+nc
                pid="lidl-"+hashlib.sha256(key.encode()).hexdigest()[:18]
                record={"id":pid,"name":name,"size":size,"category":cat,"price_ron":price,
                        "currency":"RON","shop":"Lidl","image_url":None,"stock_status":"unknown",
                        "source_url":SOURCE,"is_promotion":False}
                if pid in conflicts:
                    conflicts[pid]["prices"].add(price)
                    continue
                if pid in products and products[pid]["price_ron"]!=price:
                    # The published workbook occasionally reuses a product description
                    # for distinct rows with different prices. Without a stable article/EAN
                    # code, neither price is safe to associate with that description.
                    old=products.pop(pid)
                    conflicts[pid]={"name":name,"prices":{old["price_ron"],price}}
                    continue
                products[pid]=record
    if conflicts:
        print(f"Excluded {len(conflicts)} ambiguous product descriptions with conflicting prices.")
        for item in list(conflicts.values())[:20]:
            print(f"AMBIGUOUS {item['name']}: {sorted(item['prices'])}")
    if len(products)<200:raise RuntimeError(f"Only {len(products)} food products: not updating existing data")
    now=datetime.now(timezone.utc).isoformat(timespec="seconds")
    payload={"meta":{"store":"Lidl Romania","checked_at":now,"product_count":len(products),
            "source_url":SOURCE,"price_scope":"national permanent assortment; not store-specific",
            "stock_available":False,"promotions_included":False,"images_included":False,
            "ambiguous_products_excluded":len(conflicts)},
            "products":sorted(products.values(),key=lambda p:(norm(p["category"]),norm(p["name"])))}
    for directory in (ROOT/"data",ROOT/"docs"/"api"/"lidl"):
        directory.mkdir(parents=True,exist_ok=True)
        (directory/"lidl_products.json").write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        with (directory/"lidl_products.csv").open("w",encoding="utf-8-sig",newline="") as f:
            writer=csv.DictWriter(f,fieldnames=list(next(iter(products.values())).keys()))
            writer.writeheader();writer.writerows(payload["products"])
    print(f"Published {len(products)} products as of {now}")
if __name__=="__main__":main()
