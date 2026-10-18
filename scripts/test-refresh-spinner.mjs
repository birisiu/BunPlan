import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const css=readFileSync('android-native/app/src/main/assets/brands/bunplan-tour-refresh.css','utf8');
const js=readFileSync('android-native/app/src/main/assets/brands/bunplan-tour-refresh.js','utf8');
assert.match(css, /\.bp56-pull-indicator\.refreshing\s*\{[^}]*transform:\s*translate\(-50%,\s*0\)/s, 'Spinner must remain in viewport while refreshing');
assert.match(css, /\.bp56-pull-indicator\.refreshing \.bp56-pull-wheel\s*\{[^}]*animation:\s*bp56-rotate/s, 'Spinner must animate');
assert.match(js, /try\s*\{await syncAll\(\)\}\s*finally\s*\{resetPull\(\)\}/, 'Spinner must disappear on both success and failure');
assert.match(js, /const shouldSync=pulling&&pullDistance>=85&&!syncing&&!active/, 'Pull threshold must be respected');
console.log('PASS: pull-to-refresh spinner visible, spinning, hidden after completion');
