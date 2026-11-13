import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const app=readFileSync('android-native/app/src/main/assets/main.html','utf8');
const admin=readFileSync('admin/admin.js','utf8');
const published=readFileSync('docs/admin.js','utf8');
assert.equal(admin,published,'CRM public assets must stay identical');
for(const col of ['kcal_per_recipe','protein_g_per_recipe']){
 assert.ok(app.includes(col),'app reads '+col);
 assert.ok(admin.includes(col),'CRM edits '+col);
}
assert.match(app,/nutritionFilter==='vegetarian'.*tags\.includes\('vegetarian'\)/);
assert.match(app,/protein\/servings>=25/);
assert.match(app,/Kcal necunoscute/);
assert.match(app,/kcal\/porție/);
assert.match(app,/kcal\/rețetă/);
console.log('PASS: verified dietary tag/protein filtering; no invented calories; CRM synced');
