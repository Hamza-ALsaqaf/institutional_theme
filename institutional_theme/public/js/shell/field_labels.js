// Form controls get an accessible name (WCAG 1.3.1, 4.1.2, 3.3.2).
// Core builds each control as `<label class="control-label">` followed by an input, with no `for` on the
// label and no `id` on the input (frappe/public/js/frappe/form/controls/base_input.js:24, the wrapper
// template; the label text is written by `set_label`, base_input.js:191). A textbox therefore has an
// empty accessible name. This module points `aria-labelledby` of each control at its own label element
// and gives the label an `id` when it has none. The attribute follows the label text, so a later
// `set_label` or a translation change needs no second pass. The attribute is written even when the
// label is still empty at `form-refresh`: core fills the text a moment later.
//
// Check controls (check.js `make_wrapper`) wrap the input in a `<label>` already, so they are left alone:
// a second name would be announced twice. Controls in the cells of a grid row keep core's own naming (they
// have no visible label), but the row editor that opens under a row (`.form-in-grid`, grid_row_form.js:4) is
// a form of its own, with a label above each control, and is named like one. A control that
// already carries `aria-label` or an `aria-labelledby` of its own is not touched, and `id` and
// `aria-describedby` are never written.
//
// `form-refresh` fires before core creates the inputs (frappe/public/js/frappe/form/form.js:625 comes
// before `refresh_fields`), so one MutationObserver per form layout, created on the first `form-refresh`
// of that form, watches for added nodes and labels what appeared. Passes are batched into one animation
// frame, and each pass only writes an attribute that differs. A page without a form creates no observer.
import { defer, toElement, setAttr, warn } from "./dom.js";

const CONTROLS = "input:not([type='hidden']):not([type='checkbox']), textarea, select, [contenteditable='true']";
const ID_PREFIX = "ins-label-";
const observed = new WeakSet();
let counter = 0;

function ownLabel(wrapper) {
	const labels = wrapper.querySelectorAll(".control-label");
	for (const label of labels) {
		if (label.closest(".frappe-control") === wrapper) return label;
	}
	return null;
}

function ownControls(wrapper) {
	return Array.from(wrapper.querySelectorAll(CONTROLS)).filter(
		(control) => control.closest(".frappe-control") === wrapper && (!control.closest(".form-grid, .grid-row") || !!control.closest(".form-in-grid"))
	);
}

export function labelWrapper(wrapper) {
	if (!wrapper || !wrapper.classList || !wrapper.classList.contains("frappe-control")) return;
	const label = ownLabel(wrapper);
	if (!label || label.closest("label.checkbox, .checkbox")) return;
	const controls = ownControls(wrapper);
	if (!controls.length) return;
	if (!label.id) {
		counter += 1;
		label.id = ID_PREFIX + counter;
	}
	controls.forEach((control) => {
		if (control.hasAttribute("aria-label")) return;
		const current = control.getAttribute("aria-labelledby");
		if (current && current !== label.id) return;
		setAttr(control, "aria-labelledby", label.id);
	});
}

export function labelLayout(root) {
	if (!root || !root.querySelectorAll) return;
	root.querySelectorAll(".frappe-control").forEach(labelWrapper);
}

export function watchLayout(frm) {
	const root = frm && frm.layout && toElement(frm.layout.wrapper);
	if (!root) return;
	labelLayout(root);
	if (observed.has(root) || typeof MutationObserver !== "function") return;
	observed.add(root);
	let queued = false;
	const run = () => {
		queued = false;
		try {
			labelLayout(root);
		} catch (error) {
			warn("field labels", error);
		}
	};
	new MutationObserver((records) => {
		if (queued || !records.some((record) => record.addedNodes.length)) return;
		queued = true;
		defer(run);
	}).observe(root, { childList: true, subtree: true });
}

export function initFieldLabels() {
	if (!window.jQuery) return;
	jQuery(document).on("form-refresh.ins_shell_labels", (event, frm) => {
		try {
			watchLayout(frm);
		} catch (error) {
			warn("field labels", error);
		}
	});
}
