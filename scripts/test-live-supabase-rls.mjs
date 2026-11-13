// Read-only production smoke tests: public catalog available, admin-only RPC private.
// No user credentials, writes, or recipe edits are performed.
const base = 'https://aedyviqoelgbbrrtwayu.supabase.co/rest/v1';
const key = 'sb_publishable_pLh8mKxNWKkq396TyM518A_N_q7fm0Z';
const headers = { apikey: key, Accept: 'application/json' };
const failures = [];
async function request(path, options = {}) {
  const response = await fetch(base + path, {
    ...options, headers: { ...headers, ...(options.headers || {}) },
    signal: AbortSignal.timeout(15000), cache: 'no-store'
  });
  const raw = await response.text();
  let data; try { data = JSON.parse(raw); } catch { data = raw; }
  return { status: response.status, ok: response.ok, data };
}
function check(test, condition, details) {
  if (!condition) failures.push({ test, details });
}
const recipes = await request('/recipes?select=legacy_key,title,published&published=eq.true&limit=3');
check('public-published-recipes', recipes.ok && Array.isArray(recipes.data) &&
  recipes.data.length > 0 && recipes.data.every(r => r.published === true), recipes);
const settings = await request('/bunplan_content_sections?select=section_key,content&published=eq.true&limit=3');
check('public-cms-content', settings.ok && Array.isArray(settings.data), settings);
const adminDirectory = await request('/rpc/bunplan_admin_user_directory', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ q: '', max_rows: 10, skip_rows: 0 })
});
check('anonymous-admin-directory-denied',
  !adminDirectory.ok && [401, 403].includes(adminDirectory.status),
  { status: adminDirectory.status, body: adminDirectory.data });
const protectedUsers = await request('/bunplan_admin_users?select=user_id&limit=10');
check('anonymous-admin-roster-hidden',
  !protectedUsers.ok || (Array.isArray(protectedUsers.data) && protectedUsers.data.length === 0),
  { status: protectedUsers.status, data: protectedUsers.data });
console.log(JSON.stringify({
  passed: failures.length === 0,
  checks: 4, publicRecipeCountSample: Array.isArray(recipes.data) ? recipes.data.length : 0,
  adminDirectoryStatus: adminDirectory.status, failures
}, null, 2));
if (failures.length) process.exitCode = 1;
