// A `main` landmark for the desk (WCAG 1.3.1, 2.4.1 landmark regions; axe rules `bypass`, `region`,
// `landmark-one-main`). The desk page is `<div class="main-section"><header></header><div id="body"></div>
// <footer></footer></div>` (frappe/www/desk.html:38-42), with no `<main>` and no skip link, so a screen reader
// user has no way to jump past the navbar. `#body` is the container core fills with the page (container.js:12
// `this.container = $("#body")`); it holds one visible `.page-container` at a time, and the app sidebar is
// outside it (a child of `<body>`), so the landmark covers the page content only and never contains the
// header.
//
// One attribute is written, once: `role="main"` on `#body`. Nothing is written when the page already has a
// `<main>` or any `[role=main]` (core or an administrator added one), or when `#body` carries a role of its
// own. No node is added or moved.
export function initLandmarks() {
	const body = document.getElementById("body");
	if (!body || body.hasAttribute("role")) return;
	if (document.querySelector("main, [role='main']")) return;
	body.setAttribute("role", "main");
}
