#!/usr/bin/env python3
"""Publish dated retailer offers; never turn permanent prices into promotions."""
import json, sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from pathlib import Path
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup
from kaufland_daily import extract as kaufland_extract, SOURCE as KAUFLAND
ROOT=Path(__file__).resolve().parents[1]
TZ=ZoneInfo('Europe/Bucharest')

def lidl_extract(html, now=None):
    now=now or datetime.now(TZ)
    rows={}
    for el in BeautifulSoup(html,'html.parser').select('[data-grid-data]'):
        try:
            p=json.loads(el['data-grid-data'])
            start=datetime.fromtimestamp(float(p['storeStartDate']),TZ)
            end=datetime.fromtimestamp(float(p['storeEndDate']),TZ)
            if not start<=now<=end: continue
            category=p.get('keyfacts',{}).get('wonCategoryPrimary','')
            if 'Alimente' not in category or p.get('ageRestriction'): continue
            region=next((r for r in p.get('regionsV2',{}).values() if r.get('isDefault')),None)
            price=p.get('regionsPrices',{}).get(str(region.get('regionPriceId')),{}).get('currentPrice') if region else None
            if not price: continue
            value=price.get('price')
            if type(value) not in (float,int) or not 0<value<20000: continue
            base=price.get('basePrice',{}).get('text','')
            plus='lidl plus' in base.lower()
            rows[str(p['productId'])]={'id':'lidl-'+str(p['productId']),'store':'Lidl','name':p['fullTitle'],
                'price_ron':value,'currency':'RON','size':price.get('packaging',{}).get('text',''),
                'image_url':p.get('image'),'source_url':urljoin('https://www.lidl.ro',p['canonicalUrl']),
                'valid_from':start.date().isoformat(),'valid_to':end.date().isoformat(),
                'membership_required':plus,'kind':'Lidl Plus' if plus else 'Ofertă în magazin',
                'price_scope':'Regiunea '+region.get('regionName','implicită')+'; disponibilitate în limita stocului'}
        except (ValueError,TypeError,KeyError,OverflowError): continue
    return list(rows.values())

def get(url):
    r=requests.get(url,timeout=35,headers={'User-Agent':'BunPlan/1.0 public dated offers'})
    r.raise_for_status()
    if len(r.content)>12_000_000: raise ValueError('Response too large')
    return r.text

def main():
    target=ROOT/'docs/api/promotions/current.json'; target.parent.mkdir(parents=True,exist_ok=True)
    old=json.loads(target.read_text()) if target.exists() else {'stores':{}}
    stores={}; failed=[]; now=datetime.now(timezone.utc).isoformat()
    for store in ['Lidl','Kaufland']:
        try:
            if store=='Lidl':
                html=get('https://www.lidl.ro/'); rows=lidl_extract(html)
                soup=BeautifulSoup(html,'html.parser')
                links=list(dict.fromkeys(urljoin('https://www.lidl.ro',a['href']) for a in soup.select('a[href]') if '/c/' in a['href'] and any(x in a['href'] for x in ['piata-lidl','oferte-de','ofertele-saptamanale-lidl-plus','brutaria-lidl'])))[:12]
                for url in links:
                    try: rows+=lidl_extract(get(url))
                    except requests.RequestException: pass
                rows=list({r['id']:r for r in rows}.values())
            else:
                rows=kaufland_extract(get(KAUFLAND),datetime.now(TZ).date())['products']
                for r in rows: r['price_scope']='Magazinul implicit al site-ului Kaufland; în limita stocului'
            if not rows: raise ValueError('No current dated offers')
            stores[store]={'checked_at':now,'products':rows}
            print(store,len(rows))
        except Exception as e:
            failed.append(store); print(store,str(e),file=sys.stderr)
            if store in old.get('stores',{}): stores[store]=old['stores'][store]
    if len(failed)==2: raise RuntimeError('Both imports failed; keeping previous file')
    payload={'schema_version':1,'generated_at':now,'stores':stores}
    target.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
    if failed: print('Partial update; original source timestamps preserved:',failed,file=sys.stderr)
if __name__=='__main__': main()
