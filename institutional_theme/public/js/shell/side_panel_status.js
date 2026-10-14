// data-ins-filter on the v16.52.0 side-panel status badge, so Draft and Cancelled read as in the list (core passes no docstatus, side_panel.js:743-746).
// The filter comes from the same frappe.get_indicator call core makes; the attribute is read by desk/_status.scss.
import { setAttr, warn } from "./dom.js";

const FILTER = /^docstatus,=,[02]$/;

function markIndicator(host) {
	const badge = host.querySelector(".es-badge");
	if (!badge) return;
	let filter = null;
	try {
		const panel = window.frappe && frappe.ui && frappe.ui._side_panel;
		const doc = panel && panel.preview && panel.preview.doc;
		const doctype = panel && panel.current && panel.current.doctype;
		const indicator = doc && doctype && frappe.get_indicator ? frappe.get_indicator(doc, doctype) : null;
		if (indicator && FILTER.test(String(indicator[2] || ""))) filter = indicator[2];
	} catch (error) {
		warn("side panel status", error);
	}
	setAttr(badge, "data-ins-filter", filter);
}

export function initSidePanelStatus() {
	if (typeof MutationObserver !== "function" || !document.body) return;
	let watched = null;
	const watch = () => {
		const host = document.querySelector(".side-panel-indicator");
		if (!host || host === watched) return;
		watched = host;
		new MutationObserver(() => markIndicator(host)).observe(host, { childList: true });
		markIndicator(host);
	};
	new MutationObserver(watch).observe(document.body, { childList: true, subtree: true });
	watch();
}
