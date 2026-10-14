import { chromium, BENCH, login, setUser } from "./lib.mjs";
const ver = process.argv[2];
const b = await chromium.launch({ args: ["--no-sandbox"] });
const out = [];
for (const mode of ["Light", "Dark"]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await login(page, BENCH[ver]);
  await page.goto(BENCH[ver] + "/desk/todo"); await page.waitForTimeout(3000);
  console.log("set", await setUser(page, BENCH[ver], { desk_theme: mode, language: "en" }));
  await page.goto(BENCH[ver] + "/desk/todo"); await page.waitForTimeout(3000);
  for (const ind of ["blue", "green", "orange", "red"]) {
    const r = await page.evaluate(async (ind) => {
      document.querySelectorAll(".es-toast,.desk-alert").forEach(e=>e.remove());
      frappe.show_alert({ message: "Saved the record " + ind, indicator: ind }, 30);
      await new Promise(r => setTimeout(r, 700));
      const el = document.querySelector(".es-toast, .desk-alert");
      if (!el) return null;
      const cs = getComputedStyle(el);
      const icon = el.querySelector(":scope > svg, .indicator, .alert-icon") ;
      const msg = el.querySelector(".es-toast__message") || el;
      const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0,4).map(Number);
      return { cls: el.className, type: el.dataset.type, bg: cs.backgroundColor, text: getComputedStyle(msg).color, icon: icon ? getComputedStyle(icon).color : null };
    }, ind);
    if (r) {
      const lum = (c) => { const [R,G,B]=c.map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4}); return .2126*R+.7152*G+.0722*B; };
      const cr = (a,b)=>{const x=lum(a),y=lum(b);return ((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2)};
      const p = (s)=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
      r.textContrast = cr(p(r.text), p(r.bg)); r.iconContrast = r.icon ? cr(p(r.icon), p(r.bg)) : null;
    }
    out.push({ ver, mode, ind, ...r });
    await page.screenshot({ path: `/tmp/r4/toast-${ver}-${mode}-${ind}.png`, clip: { x: 700, y: 0, width: 580, height: 200 } });
  }
  await ctx.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
