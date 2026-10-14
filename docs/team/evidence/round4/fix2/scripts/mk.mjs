import { chromium, BENCH, login, api } from "/home/runner/work/institutional_theme/institutional_theme/docs/team/evidence/round4/review-a11y/scripts/lib.mjs";
const [which, act] = process.argv.slice(2);
const b = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await b.newContext()).newPage();
await login(page, BENCH[which]);
for (const lang of ["en","ar"]) for (const theme of ["Light","Dark"]) {
  const u = `fx2${lang}${theme.toLowerCase()}@example.com`;
  const r = act==="rm" ? await api(page,"DELETE","/api/resource/User/"+encodeURIComponent(u))
   : await api(page, "POST", "/api/resource/User", { email: u, first_name: "Fx2 "+lang+theme, send_welcome_email: 0, new_password: "Fx2-pass-9X!q", language: lang, desk_theme: theme, roles: [{role:"System Manager"}] });
  console.log(which, act, u, r.s);
}
await b.close();
