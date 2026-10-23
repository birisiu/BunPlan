import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync('android-native/app/src/main/assets/brands/bunplan-promotions.js','utf8');
let now=Date.parse('2026-10-23T12:00:00Z'),calls=0,saved,interval;
const row=(store,id,extra={})=>({id,store,name:'Produs '+id,price_ron:4.99,valid_from:'2026-10-23',valid_to:'2026-10-23',source_url:store==='Lidl'?'https://www.lidl.ro/p/test':'https://www.kaufland.ro/oferte',...extra});
const data={schema_version:1,stores:{Lidl:{checked_at:new Date(now).toISOString(),products:[row('Lidl','valid',{membership_required:true}),row('Lidl','expired',{valid_to:'2026-10-22'}),row('Lidl','future',{valid_from:'2026-10-24',valid_to:'2026-10-25'}),row('Lidl','bad',{source_url:'javascript:alert(1)'})]},Kaufland:{checked_at:new Date(now).toISOString(),products:[row('Kaufland','valid2')]}}};
const NativeDate=Date;class Clock extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}}
const context={Date:Clock,Intl,URL,AbortController,console,setTimeout,clearTimeout,setInterval:f=>interval=f,localStorage:{getItem:()=>JSON.stringify({data,fetchedAt:now}),setItem:(k,v)=>saved=v},document:{hidden:false,getElementById:()=>null,addEventListener(){}},window:{addEventListener(){}},esc:s=>String(s).replaceAll('<','&lt;'),fetch:async()=>{calls++;return {ok:true,json:async()=>data}}};
vm.runInNewContext(code,context);
let html=context.window.bunplanPromotionsHTML();assert(html.includes('Produs valid'));assert(html.includes('Produs valid2'));assert(html.includes('Cu Lidl Plus'));assert(!html.includes('Produs expired'));assert(!html.includes('Produs future'));assert(!html.includes('Produs bad'));assert.equal(calls,0);
now+=86400001;interval();await new Promise(r=>setImmediate(r));assert.equal(calls,1);assert(saved);html=context.window.bunplanPromotionsHTML();assert(!html.includes('Produs valid<'));assert(html.includes('Produs future'));
now+=3*86400000;html=context.window.bunplanPromotionsHTML();assert(!html.includes('bp-promo-card '));
console.log('PASS promotion validity, membership, URL safety, 24h refresh and stale-feed exclusion');
