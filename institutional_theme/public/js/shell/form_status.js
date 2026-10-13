// data-ins-docstatus and data-ins-new on the form page wrapper (ADR 0008, section 1).
// "form-refresh" fires after refresh_header and before refresh_fields
// (frappe/public/js/frappe/form/form.js:618-627).
import { toElement, setAttr, warn } from "./dom.js";

export function applyFormStatus(frm) {
	const wrapper = frm && frm.page && toElement(frm.page.wrapper);
	if (!wrapper || !frm.doc) return;
	const docstatus = String(parseInt(frm.doc.docstatus, 10) || 0);
	setAttr(wrapper, "data-ins-docstatus", docstatus);
	setAttr(wrapper, "data-ins-new", frm.is_new && frm.is_new() ? "1" : null);
}

export function initFormStatus() {
	if (!window.jQuery) return;
	jQuery(document).on("form-refresh.ins_shell", (event, frm) => {
		try {
			applyFormStatus(frm);
		} catch (error) {
			warn("form status", error);
		}
	});
}
