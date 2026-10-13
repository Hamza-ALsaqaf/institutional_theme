// Role-masked fields get a marker and a reason (ADR 0008, section 4). Core sends
// a placeholder value and forces the field read-only but leaves no markup
// (frappe/public/js/frappe/form/form.js:1214-1220). The reason is exposed as an
// attribute; CSS draws it as generated text.
import { toElement, setAttr, warn } from "./dom.js";

const REASON_CLASS = "ins-masked-reason";
let counter = 0;

// The reason element of one wrapper: found again on every refresh, created once.
function reasonElement(wrapper) {
	for (const child of wrapper.children) {
		if (child.classList.contains(REASON_CLASS)) return child;
	}
	const node = document.createElement("span");
	node.className = REASON_CLASS;
	counter += 1;
	node.id = "ins-masked-reason-" + counter;
	wrapper.appendChild(node);
	return node;
}

export function applyMaskedFields(frm) {
	const names = frm && frm.meta && frm.meta.masked_fields;
	if (!names || !names.length || !frm.fields_dict) return;
	// Translated at run time, in the user's language.
	const reason = __("Hidden for your role");
	names.forEach((name) => {
		const field = frm.fields_dict[name];
		const wrapper = field && toElement(field.wrapper);
		if (!wrapper) return;
		setAttr(wrapper, "data-ins-masked", "1");
		const node = reasonElement(wrapper);
		if (node.textContent !== reason) node.textContent = reason;
		wrapper.querySelectorAll("input, textarea, select").forEach((control) => {
			setAttr(control, "aria-describedby", node.id);
		});
	});
}

export function initMaskedFields() {
	if (!window.jQuery) return;
	jQuery(document).on("form-refresh.ins_shell_masked", (event, frm) => {
		try {
			applyMaskedFields(frm);
		} catch (error) {
			warn("masked fields", error);
		}
	});
}
