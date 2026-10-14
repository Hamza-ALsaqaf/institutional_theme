// Applies the accessible-name rules of a11y_rules.js to core markup as it appears (WCAG 1.3.1, 2.4.4, 4.1.2).
//
// One MutationObserver on document.body, because the elements involved live in many places that core
// creates and replaces on its own schedule: the sidebar, the page head, list and report rows, filter
// popovers, dialogs appended to the body. The callback never scans the document: it looks only at nodes
// that were added (the node itself and its descendants) and at the few attributes that can change a name
// (`data-original-title`, `title`, `data-state`, filtered by the observer and then by selector). Work is
// collected in a Set and done once per animation frame, so a burst of mutations (a list of 100 rows, a
// datatable repaint) costs one pass. A node that is no longer connected is dropped.
//
// Nothing is created, moved or removed. A failure inside one node is caught and logged; core is not
// affected. The module is idempotent: starting it twice observes once, and a rule never rewrites a value
// that is already right.
import { defer, warn } from "./dom.js";
import { ALL, ATTRIBUTES, applyRules } from "./a11y_rules.js";

let started = false;

export function scan(node) {
	if (!node || node.nodeType !== 1 || !node.isConnected) return;
	if (node.matches(ALL)) applyRules(node);
	node.querySelectorAll(ALL).forEach(applyRules);
	// A control added to a dialog or a row editor after its wrapper (input after label): the wrapper is an ancestor.
	const wrapper = node.closest(".modal .frappe-control, .form-in-grid .frappe-control");
	if (wrapper && wrapper !== node) applyRules(wrapper);
}

export function initA11yNames() {
	if (started || typeof MutationObserver !== "function" || !document.body) return;
	started = true;
	const deep = new Set();
	const shallow = new Set();
	let queued = false;
	const run = () => {
		queued = false;
		const subtrees = Array.from(deep);
		const single = Array.from(shallow);
		deep.clear();
		shallow.clear();
		subtrees.forEach((node) => {
			try {
				scan(node);
			} catch (error) {
				warn("accessible names", error);
			}
		});
		single.forEach((node) => {
			try {
				if (node.isConnected) applyRules(node);
			} catch (error) {
				warn("accessible names", error);
			}
		});
	};
	const schedule = () => {
		if (queued) return;
		queued = true;
		defer(run);
	};
	new MutationObserver((records) => {
		for (const record of records) {
			if (record.type === "attributes") {
				const target = record.target;
				if (target.nodeType === 1 && target.matches("button")) shallow.add(target);
				continue;
			}
			record.addedNodes.forEach((node) => {
				if (node.nodeType === 1) deep.add(node);
			});
		}
		if (deep.size || shallow.size) schedule();
	}).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ATTRIBUTES });
	deep.add(document.body);
	schedule();
}
