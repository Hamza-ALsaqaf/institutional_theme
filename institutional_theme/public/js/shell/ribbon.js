// Environment ribbon (ADR 0005, 0008 section 5). Shown only when the server
// reports a non-production environment in frappe.boot.ins.environment.
import { setAttr } from "./dom.js";

const RIBBON_CLASS = "ins-env-ribbon";

// The word is translated at run time. Anything that is not production and not
// one of the named environments reads "Non-production": when in doubt, show it.
function environmentLabel(value) {
	const key = String(value || "").trim().toLowerCase();
	if (!key || key === "production") return null;
	if (key === "training") return { key: "training", text: __("Training") };
	if (key === "uat") return { key: "uat", text: __("UAT") };
	if (key === "staging") return { key: "staging", text: __("Staging") };
	return { key: "non-production", text: __("Non-production") };
}

export function applyRibbon() {
	const ins = window.frappe && frappe.boot && frappe.boot.ins;
	const environment = environmentLabel(ins && ins.environment);
	const root = document.documentElement;
	let ribbon = document.body && document.body.querySelector(":scope > ." + RIBBON_CLASS);
	if (!environment) {
		setAttr(root, "data-ins-environment", null);
		if (ribbon) ribbon.remove();
		return;
	}
	setAttr(root, "data-ins-environment", environment.key);
	if (!document.body) return;
	if (!ribbon) {
		ribbon = document.createElement("div");
		ribbon.className = RIBBON_CLASS;
		ribbon.setAttribute("role", "note");
		document.body.appendChild(ribbon);
	}
	if (ribbon.textContent !== environment.text) ribbon.textContent = environment.text;
}

export function initRibbon() {
	if (document.body) {
		applyRibbon();
	} else {
		document.addEventListener("DOMContentLoaded", applyRibbon, { once: true });
	}
}
