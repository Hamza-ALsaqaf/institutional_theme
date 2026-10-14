import { chromium, BENCH, login, api, PWD } from "./lib.mjs";
const which = process.argv[2];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const page = await (await b.newContext()).newPage();
await login(page, BENCH[which]);
for (const [u, lang, theme] of [["rev4rcar@example.com","ar","Light"],["rev4rcen@example.com","en","Light"],["rev4rcard@example.com","ar","Dark"],["rev4rcend@example.com","en","Dark"]]) {
  const r = await api(page, "POST", "/api/resource/User", { email: u, first_name: "Rc "+u.slice(6,10), send_welcome_email: 0, new_password: PWD, language: lang, desk_theme: theme, roles: [{role:"System Manager"}] });
  console.log(which, u, r.s, r.t.slice(0,100));
}
await b.close();
