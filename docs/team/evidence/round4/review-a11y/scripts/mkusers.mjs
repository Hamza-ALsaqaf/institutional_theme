import { chromium, BENCH, login, api } from "./lib.mjs";
const which = process.argv[2];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await b.newContext()).newPage();
await login(page, BENCH[which]);
for (const [u, lang, theme] of [["rev4ar@example.com","ar","Light"]]) {
  const r = await api(page, "POST", "/api/resource/User", { email: u, first_name: "Rev4 "+u.slice(4,8), send_welcome_email: 0, new_password: "Rev4-pass-9X!q", language: lang, desk_theme: theme, roles: [{role:"System Manager"}] });
  console.log(which, u, r.s, r.t.slice(0,120));
}
await b.close();
