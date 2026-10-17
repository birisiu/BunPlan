#!/usr/bin/env python3
"""One-time BunPlan seed to an authorized Supabase PostgreSQL project.

Never publish service-role key to the app or repository. Uses secrets in CI.
Sources: data/bunplan_recipes_v1.json, data/bunplan_estimated_packs_v1.json.
"""
import os,json
from pathlib import Path
import requests

BASE=Path(__file__).resolve().parents[1]
URL=os.environ.get("SUPABASE_URL","").rstrip("/")
KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY","")
if not URL.startswith("https://") or not KEY:raise SystemExit("Configure Supabase GitHub Actions secrets first")
S=requests.Session()
S.headers.update({"apikey":KEY,"Authorization":"Bearer "+KEY,
  "Content-Type":"application/json","Prefer":"resolution=merge-duplicates,return=representation"})

def upsert(table,rows,conflict,batch=100):
 out=[]
 for i in range(0,len(rows),batch):
  r=S.post(f"{URL}/rest/v1/{table}",params={"on_conflict":conflict},
   json=rows[i:i+batch],timeout=50)
  if not r.ok:raise RuntimeError(f"{table}: {r.status_code} {r.text[:800]}")
  out.extend(r.json())
 return out

def main():
 data=json.loads((BASE/"data"/"bunplan_recipes_v1.json").read_text(encoding="utf-8"))
 budget=json.loads((BASE/"data"/"bunplan_estimated_packs_v1.json").read_text(encoding="utf-8"))
 units=data["ingredient_units"]
 rows=[{"slug":slug,"name":slug.replace("_"," ").capitalize(),"base_unit":unit}
        for slug,unit in units.items()]
 ingredients=upsert("ingredients",rows,"slug")
 ingids={i["slug"]:i["id"] for i in ingredients}
 assert len(ingids)==107, f"Expected 107 ingredients, got {len(ingids)}"
 recipes=[{"legacy_key":str(r["id"]),"title":r["title"],"description":None,
   "category":r["category"],"servings":r["servings"],
   "minutes_to_prepare":r["minutes"],"instructions":r["steps"],
   "photo_url":None,"published":True} for r in data["recipes"]]
 inserted=upsert("recipes",recipes,"legacy_key")
 ids={r["legacy_key"]:r["id"] for r in inserted}
 rel=[]
 for r in data["recipes"]:
  for x in r["ingredients"]:
   rel.append({"recipe_id":ids[r["id"]],"ingredient_id":ingids[x["id"]],
     "amount":x["quantity"],"unit":x["unit"]})
 upsert("recipe_ingredients",rel,"recipe_id,ingredient_id")
 estimates=[]
 for item in budget["rows"]:
  slug,qty,lidl,kaufland=item
  for store,price in (("lidl",lidl),("kaufland",kaufland)):
   estimates.append({"store_id":store,"ingredient_id":ingids[slug],
    "suggested_pack_quantity":qty,"pack_unit":units[slug],
    "estimated_pack_price_ron":price,"estimate_method":"budget_model_unverified"})
 upsert("price_estimates",estimates,"store_id,ingredient_id")
 print(f"Seeded {len(ingids)} ingredients, {len(ids)} recipes, {len(rel)} components and {len(estimates)} independent budget estimates")

if __name__=="__main__":main()
