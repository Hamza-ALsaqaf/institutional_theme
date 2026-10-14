/* The proof's own script (not the product's). Controls: screen, mode, language and direction, density, preset, fonts, contrast panel. */
(function () {
	"use strict";
	var data = JSON.parse(document.getElementById("proof-data").textContent);
	var root = document.documentElement;
	var state = { screen: "list", mode: "light", lang: "en", density: "comfortable", preset: "midad", fonts: "plex" };
	var mq = window.matchMedia("(prefers-color-scheme: dark)");

	function docs() {
		var out = [document], frame = document.getElementById("proof-login");
		if (frame && frame.contentDocument && frame.contentDocument.documentElement) out.push(frame.contentDocument);
		return out;
	}

	function dirOf(lang) { return lang === "ar" ? "rtl" : "ltr"; }

	function applyStyles(doc) {
		var dir = dirOf(state.lang);
		Array.prototype.forEach.call(doc.querySelectorAll("style[data-src][data-dir]"), function (s) {
			var on = s.getAttribute("data-dir") === dir;
			var kind = s.getAttribute("data-kind"), name = s.getAttribute("data-name");
			if (kind === "palette") on = on && name === state.preset;
			if (kind === "fonts") on = on && name === state.fonts;
			if (s.sheet) s.sheet.disabled = !on;
		});
	}

	function resolvedTheme() {
		return state.mode === "automatic" ? (mq.matches ? "dark" : "light") : state.mode;
	}

	function swapStrings(doc) {
		var table = data.strings[state.lang];
		Array.prototype.forEach.call(doc.querySelectorAll("[data-i18n]"), function (el) { el.textContent = table[el.getAttribute("data-i18n")]; });
		["placeholder", "title", "aria-label"].forEach(function (a) {
			Array.prototype.forEach.call(doc.querySelectorAll("[data-i18n-" + a + "]"), function (el) { el.setAttribute(a, table[el.getAttribute("data-i18n-" + a)]); });
		});
	}

	function applyRoot(doc) {
		var r = doc.documentElement;
		r.setAttribute("lang", state.lang);
		r.setAttribute("dir", dirOf(state.lang));
		if (doc === document) {
			r.setAttribute("data-theme-mode", state.mode);
			r.setAttribute("data-theme", resolvedTheme());
			r.setAttribute("data-ins-density", state.density);
		}
		Array.prototype.forEach.call(doc.querySelectorAll(".ins-lang-link"), function (a) {
			if (a.getAttribute("lang") === state.lang) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
		});
		Array.prototype.forEach.call(doc.querySelectorAll(".datatable"), function (d) { d.setAttribute("dir", dirOf(state.lang)); });
	}

	function showScreen() {
		Array.prototype.forEach.call(document.querySelectorAll(".proof-screen"), function (s) { s.hidden = s.getAttribute("data-screen") !== state.screen; });
	}

	function contrast() {
		var panel = document.getElementById("proof-contrast"), body = panel.querySelector("tbody");
		var rows = ((data.contrast[state.preset] || {})[resolvedTheme()] || []);
		body.textContent = "";
		rows.forEach(function (r) {
			var tr = document.createElement("tr");
			[r.group, r.fg + " " + r.fg_hex, r.bg + " " + r.bg_hex, r.ratio.toFixed(2), String(r.min), r.pass ? "pass" : "fail"].forEach(function (t, i) {
				var td = document.createElement("td"); td.textContent = t; if (i === 5 && !r.pass) td.className = "fail"; tr.appendChild(td);
			});
			body.appendChild(tr);
		});
	}

	function announce(msg) { document.getElementById("proof-status").textContent = msg; }

	function applyAll() {
		docs().forEach(function (d) { applyStyles(d); applyRoot(d); swapStrings(d); });
		showScreen();
		contrast();
		Object.keys(state).forEach(function (g) {
			Array.prototype.forEach.call(document.querySelectorAll('#proof-toolbar input[name="proof-' + g + '"]'), function (i) { i.checked = i.value === state[g]; });
		});
		window.__proofState = Object.assign({}, state, { theme: resolvedTheme() });
	}

	function loadLogin() {
		var frame = document.getElementById("proof-login");
		var src = document.getElementById(frame.getAttribute("data-srcdoc-id")).textContent;
		frame.addEventListener("load", function () { applyAll(); });
		frame.srcdoc = src;
	}

	Array.prototype.forEach.call(document.querySelectorAll("#proof-toolbar input[type=radio]"), function (input) {
		input.addEventListener("change", function () {
			var group = input.name.replace("proof-", "");
			state[group] = input.value;
			applyAll();
			announce(input.parentNode.textContent.replace(/\s+/g, " ").trim());
		});
	});

	var toggle = document.getElementById("proof-contrast-toggle");
	toggle.addEventListener("click", function () {
		var panel = document.getElementById("proof-contrast");
		panel.hidden = !panel.hidden;
		toggle.setAttribute("aria-expanded", String(!panel.hidden));
	});
	mq.addEventListener("change", function () { if (state.mode === "automatic") applyAll(); });

	applyAll();
	loadLogin();
	window.__proofApply = function (patch) { Object.assign(state, patch); applyAll(); };
})();
