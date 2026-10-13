// Role-masked fields get a marker and a reason (ADR 0008, section 4). Core sends
// a placeholder value and forces the field read-only but leaves no markup
// (frappe/public/js/frappe/form/form.js:1214-1220). The reason is exposed as an
// attribute; CSS draws it as generated text.
import { toElement, setAttr, warn } from "./dom.js";

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
		setAttr(wrapper, "data-ins-masked-label", reason);
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
