import { chromium, BENCH, login, api } from "./lib.mjs";
const which = process.argv[2];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await b.newContext()).newPage();
await login(page, BENCH[which]);
for (const u of ["rev4rcar@example.com","rev4rcen@example.com","rev4rcard@example.com","rev4rcend@example.com"]) {
  const r = await api(page, "DELETE", "/api/resource/User/"+encodeURIComponent(u));
  console.log(which, u, r.s, r.t.slice(0,60));
}
const left = await api(page, "GET", '/api/resource/User?filters=[["name","like","rev4%"]]');
console.log(which, 'left', left.t.slice(0,80));
const adm = await api(page, "GET", '/api/resource/User/Administrator');
console.log(which, 'admin', adm.t.match(/"desk_theme":[^,]*|"language":[^,]*/g));
await b.close();
