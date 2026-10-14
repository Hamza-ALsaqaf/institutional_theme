import { chromium, login, BASE } from "./lib.mjs";
const variant = process.argv[2] || "themed";
const b = await chromium.launch({ args: ["--no-sandbox"] });
const { ctx, page } = await login(b, "en", variant === "core" ? { block: "**/assets/institutional_theme/**" } : {});
const cdp = await ctx.newCDPSession(page);
await cdp.send("Runtime.enable");
const out = [];
cdp.on("Runtime.exceptionThrown", (e) => { const d = e.exceptionDetails; out.push({ text: d.text, exc: d.exception && (d.exception.description || d.exception.value || d.exception.type), url: d.url, line: d.lineNumber, frames: (d.stackTrace?.callFrames || []).slice(0, 6).map((f) => `${f.functionName}@${f.url.split("/").pop()}:${f.lineNumber}`), cur: page.url() }); });
page.on("response", (r) => { if (r.status() >= 400) out.push({ http: r.status(), url: r.url().slice(0, 140) }); });
for (const route of ["/desk/invoicing", "/desk/query-report/General%20Ledger"]) {
	await page.goto(BASE + route);
	await page.waitForTimeout(6000);
}
console.log(variant, JSON.stringify(out, null, 1));
await b.close();
