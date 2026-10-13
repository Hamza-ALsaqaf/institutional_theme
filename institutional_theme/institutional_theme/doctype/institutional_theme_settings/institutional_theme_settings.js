// Institutional Theme Settings. Presentation only: every rule is enforced on the server.
frappe.ui.form.on("Institutional Theme Settings", {
	refresh(frm) {
		// The server names an uploaded font that is no longer on disk (for example after a restore).
		const message = (frm.doc.__onload || {}).missing_font_message;
		frm.set_intro(message || "", message ? "orange" : null);
	},
});
