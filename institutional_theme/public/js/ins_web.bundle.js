// Login and update-password: the password reveal as a real button (WCAG 2.1.1, 4.1.2, 2.5.8).
// Core ships `svg.toggle-password`: no tabindex, role or name, 16px. This script wraps each one in
// `<button type="button" aria-pressed>`, toggles the input type the way core does, and drops the
// svg's class so core's pointer-only styles stop applying. No dependencies; idempotent.
// The label is read from `[data-ins-reveal-labels]`, rendered translated by `web_content.py`:
// `__()` only reads `frappe._messages`, which website pages do not fill, so it stays English there.
(function () {
	"use strict";

	var SHOW = "#es-line-preview";
	var HIDE = "#es-line-hide";

	function labels() {
		var holder = document.querySelector("[data-ins-reveal-labels]");
		return {
			show: (holder && holder.getAttribute("data-show")) || "Show password",
			hide: (holder && holder.getAttribute("data-hide")) || "Hide password",
		};
	}

	function sync(button, input) {
		var shown = input.getAttribute("type") === "text";
		var text = labels();
		button.setAttribute("aria-pressed", shown ? "true" : "false");
		button.setAttribute("aria-label", shown ? text.hide : text.show);
		var use = button.querySelector("use");
		if (use) use.setAttribute("href", shown ? HIDE : SHOW);
	}

	function wrap(icon) {
		if (icon.closest(".ins-reveal")) return;
		var input = document.querySelector(icon.getAttribute("toggle") || "");
		if (!input) return;
		var button = document.createElement("button");
		button.type = "button";
		button.className = "ins-reveal";
		icon.parentNode.insertBefore(button, icon);
		button.appendChild(icon);
		icon.classList.remove("toggle-password");
		icon.setAttribute("aria-hidden", "true");
		icon.setAttribute("focusable", "false");
		button.addEventListener("click", function () {
			input.setAttribute("type", input.getAttribute("type") === "password" ? "text" : "password");
			sync(button, input);
		});
		sync(button, input);
	}

	// Core ships `.text-muted { color: #7c7c7c !important }` (4.2:1 on white). On error pages the muted
	// class sits on the "Back to Home" link, so drop it and let the link colour from _error_pages.scss apply.
	function unmuteErrorLinks() {
		var links = document.querySelectorAll("body.ins-error .details a.text-muted");
		for (var j = 0; j < links.length; j++) links[j].classList.remove("text-muted");
	}

	function run() {
		unmuteErrorLinks();
		var icons = document.querySelectorAll("svg.toggle-password");
		for (var i = 0; i < icons.length; i++) wrap(icons[i]);
	}

	function start() {
		run();
		if (typeof MutationObserver === "function") {
			new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
		}
	}

	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
	else start();
})();
