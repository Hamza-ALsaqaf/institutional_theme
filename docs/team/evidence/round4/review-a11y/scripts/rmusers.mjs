import { chromium, BENCH, login, api } from "./lib.mjs";
const which = process.argv[2];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await b.newContext()).newPage();
await login(page, BENCH[which]);
for (const u of ["rev4ar@example.com"]) {
  const r = await api(page, "DELETE", "/api/resource/User/"+encodeURIComponent(u));
  console.log(which, u, r.s, r.t.slice(0,60));
}
const left = await api(page, "GET", '/api/resource/User?filters=[["name","like","rev4%"]]');
console.log(which, 'left', left.t.slice(0,80));
const adm = await api(page, "GET", '/api/resource/User/Administrator?fields=["desk_theme","language"]');
console.log(which, 'admin', adm.t.slice(0,300).match(/"desk_theme":[^,]*|"language":[^,]*/g));
await b.close();
