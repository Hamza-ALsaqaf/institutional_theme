// data-ins-filter on the v16.52.0 side-panel status badge, so Draft and Cancelled read as in the list (core passes no docstatus, side_panel.js:743-746).
// The filter comes from the same frappe.get_indicator call core makes; the attribute is read by desk/_status.scss.
import { setAttr, warn } from "./dom.js";

const FILTER = /^docstatus,=,[02]$/;

function markIndicator(host) {
	const badge = host.querySelector(".es-badge");
	if (!badge) return;
	let filter = null;
	try {
		// The public accessor returns the singleton; it only constructs a panel when none exists, and this runs once the host (so the panel) exists.
		const panel = window.frappe && frappe.ui && (frappe.ui.get_side_panel ? frappe.ui.get_side_panel() : frappe.ui._side_panel);
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
	const attach = (host) => {
		new MutationObserver(() => markIndicator(host)).observe(host, { childList: true });
		markIndicator(host);
	};
	const existing = document.querySelector(".side-panel-indicator");
	if (existing) return attach(existing);
	// Core appends the panel to <body> once (side_panel.js:415) and never removes it (hide() only toggles classes, :800-811), so one direct-child
	// observer, no subtree, looks at the added node only and disconnects when it finds the host.
	const waiting = new MutationObserver((records) => {
		for (const record of records) {
			for (const node of record.addedNodes) {
				if (node.nodeType !== 1) continue;
				const host = node.matches(".side-panel-indicator") ? node : node.querySelector(".side-panel-indicator");
				if (!host) continue;
				waiting.disconnect();
				attach(host);
				return;
			}
		}
	});
	waiting.observe(document.body, { childList: true });
}
