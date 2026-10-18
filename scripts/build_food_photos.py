#!/usr/bin/env python3
"""Bundled Wikimedia Commons food photographs with license attribution.
Only downloads freely reusable photographs. No generic placeholder images
are mislabeled as an exact depiction of every variation of a recipe.
Outputs:
 - android-native/app/src/main/assets/brands/photos/*.webp
 - android-native/app/src/main/assets/brands/food-photos-generated.js
Source/license data is included in the latter for app attribution.
"""
import concurrent.futures
import io
import json
import os
import re
import sys
import time
import unicodedata
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from PIL import Image, ImageOps

DEST = Path("android-native/app/src/main/assets/brands")
IMAGE_DIR = DEST / "photos"
IMAGE_DIR.mkdir(parents=True, exist_ok=True)
API = "https://commons.wikimedia.org/w/api.php"
UA = "BunPlan/5.0 (https://github.com/birisiu/BunPlan; open-license photo attribution)"
FAMILY_SEARCH = {
"Ardei umpluți":"stuffed peppers food",
"Bol rece":"healthy grain bowl salad",
"Brioșe fragede":"blueberry muffins",
"Budincă de chia":"chia pudding fruit",
"Bulgur":"bulgur salad",
"Burger de casă":"hamburger beef burger",
"Chiftele de curcan":"meatballs with vegetables",
"Chiftele vegetariene":"vegetarian patties food",
"Chifteluțe de vită la cuptor":"meatballs tomato sauce",
"Ciorbă de fasole":"bean soup bowl",
"Ciorbă de legume":"vegetable soup",
"Clătite de ovăz":"pancakes berries",
"Cotlet de porc la tigaie":"grilled pork chop plate",
"Couscous":"couscous salad",
"Creveți sotați":"fried shrimp vegetables",
"Crumble la cuptor":"apple crumble dessert",
"Curry de pui":"chicken curry bowl",
"Curry vegetarian":"vegetable curry bowl",
"Dovlecei umpluți":"stuffed zucchini baked",
"File de pește la cuptor":"baked fish fillet vegetables",
"Frigărui de pui":"chicken kebab skewers",
"Frittata la cuptor":"frittata vegetables",
"Gratin de legume":"vegetable gratin",
"Legume la cuptor":"roasted vegetables",
"Lipie umplută":"vegetable wrap sandwich",
"Mâncare de legume":"vegetable stew",
"Omletă pufoasă":"omelette vegetables",
"Ovăz peste noapte":"overnight oats",
"Paste":"penne pasta vegetables",
"Pește la tigaie":"fried fish plate",
"Piept de pui la tigaie":"grilled chicken breast food",
"Pilaf":"rice pilaf food",
"Porc la cuptor":"roast pork potatoes",
"Pui sotat":"sauteed chicken vegetables",
"Pulpe de pui la cuptor":"roasted chicken legs",
"Risotto":"mushroom risotto",
"Ruladă de curcan":"turkey roulade",
"Salată consistentă":"vegetable salad bowl",
"Supă asiatică":"noodle soup vegetables",
"Supă cremă":"cream vegetable soup",
"Supă de linte":"lentil soup bowl",
"Supă de pui":"chicken soup",
"Tavă cu somon,  și":"salmon roasted vegetables",
"Terci de ovăz cald":"oatmeal berries bowl",
"Toast integral":"avocado toast",
"Tocană vegetariană":"vegetarian bean stew",
"Tocăniță de pui":"chicken stew",
"Tocăniță de vită":"beef stew",
"Wok vegetarian":"stir fried vegetables wok",
"Wrap de mic dejun":"breakfast wrap"
}
INGREDIENT_SEARCH = {
"ovaz":"rolled oats","mere":"red apples","pui_piept":"raw chicken breast",
"pui_pulpe":"chicken thighs","morcovi":"carrots","rosii":"fresh tomatoes","ceapa":"yellow onion",
"cartofi":"potatoes","usturoi":"garlic cloves","broccoli":"broccoli","banane":"bananas",
"lapte":"glass of milk","oua":"chicken eggs","faina":"wheat flour","orez":"rice grains",
"paste":"dry penne pasta","linte":"dry lentils","fasole":"dry white beans",
"branza_vaci":"cottage cheese","telemea":"feta cheese","iaurt":"yogurt","spanac":"spinach",
"avocado":"avocado fruit","castraveti":"cucumbers","ardei":"bell peppers",
"ulei":"olive oil bottle","ulei_masline":"olive oil","somon":"salmon fillet",
"ton":"canned tuna","ciuperci":"mushrooms","conopida":"cauliflower",
"nuci":"walnuts","afine":"blueberries","sare":"salt bowl","mozzarella":"mozzarella",
"curcan":"turkey breast","vita":"raw beef steak","porc":"pork meat","mazare":"peas",
"cascaval":"cheddar cheese","dovlecel":"zucchini","peste_alb":"white fish fillet",
"paine":"wholemeal bread","lamiie":"lemons","lamaie":"fresh lemon",
"salata":"lettuce","piper":"black pepper","miere":"honey jar","naut":"chickpeas",
"creveti":"shrimp","unt":"butter","parmezan":"parmesan cheese","fructe_padure":"mixed berries",
"rosii_conserva":"tomato puree","seminte_chia":"chia seeds"
}
def slug(s):
    s = unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode('ascii')
    return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
def get_bytes(url, max_bytes=1_700_000):
    req=Request(url,headers={'User-Agent':UA,'Accept':'application/json,image/*;q=0.9,*/*;q=0.4'})
    with urlopen(req,timeout=15) as response:
        if int(response.headers.get('Content-Length') or 0)>max_bytes:
            raise RuntimeError('oversized photo')
        return response.read(max_bytes+1)
def image_candidates(query):
    params={
      'action':'query','generator':'search','gsrsearch':'filetype:bitmap '+query,
      'gsrnamespace':6,'gsrlimit':8,'prop':'imageinfo',
      'iiprop':'url|extmetadata|size','iiurlwidth':630,'format':'json','formatversion':2
    }
    data=json.loads(get_bytes(API+'?'+urlencode(params),max_bytes=600_000))
    for page in data.get('query',{}).get('pages',[]):
        title=page.get('title','')
        if not title.lower().endswith(('.jpg','.jpeg','.png','.webp')):continue
        for info in page.get('imageinfo',[]):
            meta=info.get('extmetadata') or {}
            license=(meta.get('LicenseShortName') or {}).get('value','').strip()
            low=license.lower()
            if not (low.startswith('cc by') or low.startswith('cc0') or low in ('public domain','pd','public domain mark')):continue
            if ('-nc' in low or '-nd' in low):continue
            if info.get('width',0)<400 or info.get('height',0)<280:continue
            url=info.get('thumburl')
            if not url:continue
            yield {'url':url,'attribution_url':info.get('descriptionurl',''),'license':license,
                   'author':re.sub('<[^>]*>','',(meta.get('Artist') or {}).get('value',''))[:180],
                   'file':title}
def download_one(entry):
    kind,key,term=entry
    out=IMAGE_DIR/(kind+'-'+slug(key)+'.webp')
    if out.is_file() and out.stat().st_size>5_000:
        return kind,key,{'src':'brands/photos/'+out.name,'source':'','license':'Previously downloaded'}
    # Prefer a visually relevant image, do not fall back to unrelated titles.
    for index,photo in enumerate(image_candidates(term)):
        if index>=5:break
        try:
            raw=get_bytes(photo['url'])
            if len(raw)>1_700_000:continue
            im=Image.open(io.BytesIO(raw));im.load()
            if im.width<400 or im.height<280:continue
            im=ImageOps.fit(im.convert('RGB'),(560,390),method=Image.Resampling.LANCZOS)
            im.save(out,'WEBP',quality=77,method=5)
            return kind,key,{'src':'brands/photos/'+out.name,'source':photo['attribution_url'],
                        'license':photo['license'],'author':photo['author'],'file':photo['file']}
        except Exception:continue
    return kind,key,None
def main():
    jobs=[('recipes',k,v) for k,v in FAMILY_SEARCH.items()]
    jobs += [('ingredients',k,v) for k,v in INGREDIENT_SEARCH.items()]
    if os.getenv('BUNPLAN_PHOTO_SAMPLE','')=='1':
        jobs=jobs[:5]+jobs[50:55]
    manifest={'recipes':{},'ingredients':{},'notice':'Representative photos, not photographs of each exact recipe variation.',
              'credit':'Photographs: Wikimedia Commons. Individual credits under each image.'}
    errors=0
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        futures={pool.submit(download_one,job):job for job in jobs}
        for i,future in enumerate(concurrent.futures.as_completed(futures)):
            try:
                kind,key,photo=future.result()
                if photo:manifest[kind][key]=photo
                else:errors+=1
            except Exception as e:errors+=1
            if (i+1)%20==0:print(f'Food images: {i+1}/{len(jobs)}',flush=True)
    target=DEST/'food-photos-generated.js'
    target.write_text('window.BunPlanPhotoMap='+json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    count=sum(len(manifest[k]) for k in ('recipes','ingredients'))
    print(f'BunPlan Commons photos: {count}/{len(jobs)} downloaded, {errors} unavailable',flush=True)
    if count<10 and os.getenv('BUNPLAN_PHOTO_SAMPLE','')!='1':
        print('Not enough verified food photos; refusing to mark visual build complete',file=sys.stderr)
        sys.exit(1)
if __name__=='__main__':main()
