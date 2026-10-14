// Invalid form fields get `aria-invalid="true"` (WCAG 3.3.1, 4.1.2).
// Core marks an invalid or empty mandatory control by toggling the class `has-error` on the control
// wrapper `.frappe-control` (frappe/public/js/frappe/form/controls/base_input.js, `set_mandatory` and
// `set_invalid`, called from base_control.js `parse_validate_and_set_in_model`). Core writes no
// message element per field (its message is the dialog `frappe.msgprint` raises on save), so there is
// nothing to link with `aria-describedby`; the attribute on the input is the only addition.
//
// One MutationObserver per form layout, created on the first `form-refresh` of that form, watching
// the `class` attribute only. A page without a form never creates one. Attributes only.
import { toElement, setAttr, warn } from "./dom.js";

const CONTROLS = "input:not([type='hidden']), textarea, select, [contenteditable='true']";
const observed = new WeakSet();

// The controls that belong to this wrapper itself: a Table control wrapper that gets `has-error`
// must not mark the inputs of its grid rows, which sit inside their own `.frappe-control`.
function controlsOf(wrapper) {
	return Array.from(wrapper.querySelectorAll(CONTROLS)).filter(
		(control) => control.closest(".frappe-control") === wrapper
	);
}

export function syncWrapper(wrapper) {
	if (!wrapper || !wrapper.classList || !wrapper.classList.contains("frappe-control")) return;
	const invalid = wrapper.classList.contains("has-error") ? "true" : null;
	controlsOf(wrapper).forEach((control) => setAttr(control, "aria-invalid", invalid));
}

export function syncLayout(root) {
	if (!root || !root.querySelectorAll) return;
	root.querySelectorAll(".frappe-control").forEach(syncWrapper);
}

export function applyFieldErrors(frm) {
	const root = frm && frm.layout && toElement(frm.layout.wrapper);
	if (!root) return;
	syncLayout(root);
	if (observed.has(root) || typeof MutationObserver !== "function") return;
	observed.add(root);
	new MutationObserver((records) => {
		try {
			records.forEach((record) => syncWrapper(record.target));
		} catch (error) {
			warn("field errors", error);
		}
	}).observe(root, { attributes: true, attributeFilter: ["class"], subtree: true });
}

export function initFieldErrors() {
	if (!window.jQuery) return;
	jQuery(document).on("form-refresh.ins_shell_errors", (event, frm) => {
		try {
			applyFieldErrors(frm);
		} catch (error) {
			warn("field errors", error);
		}
	});
}
