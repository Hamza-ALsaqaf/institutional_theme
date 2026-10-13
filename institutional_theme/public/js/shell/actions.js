// Consequential-action tagging (ADR 0008, section 3). CSS keys on data-ins-action
// only. Labels are compared with __() evaluated at run time, so they are equal to
// what the toolbar rendered in every language. State conditions stop same-text
// items (Arabic collapses several sources onto one string) being tagged in the
// wrong state. False positives are accepted; a miss hides a consequence.
import { toElement, setAttr, warn } from "./dom.js";

const ATTR = "data-ins-action";
const WORKFLOW_WORDS = /\b(approve|approval|authorise|authorize|reject|decline|return|cancel|void|submit|delete|amend|close|pay)\b/i;
const REJECT_WORDS = /\b(reject|decline|return)\b/i;
const CANCEL_WORDS = /\b(cancel|void)\b/i;

// The six values and their English source labels.
const CUSTOM_LABELS = [
	["submit", "Submit"],
	["cancel", "Cancel"],
	["amend", "Amend"],
	["delete", "Delete"],
	["approve", "Approve"],
	["reject", "Reject"],
];

const observers = new WeakMap();

function norm(text) {
	return String(text === null || text === undefined ? "" : text)
		.replace(/\s+/g, " ")
		.trim();
}

function normLower(text) {
	return norm(text).toLowerCase();
}

function decodeLabel(raw) {
	try {
		return decodeURIComponent(raw);
	} catch (error) {
		return raw;
	}
}

function docStatusOfState(workflow, state) {
	const rows = (workflow && workflow.states) || [];
	for (let i = 0; i < rows.length; i++) {
		if (rows[i].state === state) return parseInt(rows[i].doc_status, 10) || 0;
	}
	return null;
}

// Workflow transitions are read from the local workflow cache; no network call.
export function workflowActionMap(frm) {
	const map = new Map();
	const workflow = frappe.workflow && frappe.workflow.workflows && frappe.workflow.workflows[frm.doctype];
	if (!workflow || !frappe.workflow.get_all_transitions) return map;
	frappe.workflow.get_all_transitions(frm.doctype).forEach((transition) => {
		const action = transition && transition.action;
		if (!action) return;
		const from = docStatusOfState(workflow, transition.state);
		const to = docStatusOfState(workflow, transition.next_state);
		const statusChange = from !== null && to !== null && from !== to;
		if (!WORKFLOW_WORDS.test(action) && !statusChange) return;
		let value = "approve";
		if (REJECT_WORDS.test(action)) value = "reject";
		else if (CANCEL_WORDS.test(action) || to === 2) value = "cancel";
		const label = norm(__(action));
		if (!map.has(label)) map.set(label, value);
	});
	return map;
}

// Returns Map(element -> value) for every element the rules tag in this state.
export function computeTags(frm, head) {
	const tags = new Map();
	const docstatus = parseInt(frm.doc && frm.doc.docstatus, 10) || 0;
	const labels = {
		submit: norm(__("Submit")),
		cancel: norm(__("Cancel")),
		amend: norm(__("Amend")),
		delete: norm(__("Delete")),
	};

	head.querySelectorAll("button.primary-action").forEach((el) => {
		const text = norm(el.textContent);
		if (text === labels.submit && docstatus === 0) tags.set(el, "submit");
		else if (text === labels.amend && docstatus === 2) tags.set(el, "amend");
	});
	head.querySelectorAll("button.btn-secondary").forEach((el) => {
		const text = norm(el.textContent);
		if (text === labels.cancel && docstatus === 1) tags.set(el, "cancel");
		else if (text === labels.amend && docstatus === 2) tags.set(el, "amend");
	});

	head.querySelectorAll(".menu-btn-group .menu-item-label").forEach((el) => {
		if (norm(el.textContent) === labels.delete && docstatus !== 1) {
			const link = el.closest("a") || el;
			tags.set(link, "delete");
		}
	});

	// Custom buttons and grouped buttons: any of the six labels, in either the
	// source language or the user's language, whatever the document state.
	const customValues = new Map();
	CUSTOM_LABELS.forEach(([value, english]) => {
		customValues.set(normLower(english), value);
		customValues.set(normLower(__(english)), value);
	});
	head.querySelectorAll(".custom-actions button[data-label], .inner-group-button .dropdown-item[data-label]").forEach((el) => {
		const value = customValues.get(normLower(decodeLabel(el.getAttribute("data-label"))));
		if (value) tags.set(el, value);
	});

	// Workflow transitions in the Actions menu.
	const actions = head.querySelectorAll(".actions-btn-group .menu-item-label");
	if (actions.length) {
		const byLabel = workflowActionMap(frm);
		actions.forEach((el) => {
			const value = byLabel.get(norm(el.textContent));
			if (value) tags.set(el.closest("a") || el, value);
		});
	}
	return tags;
}

export function tagActions(frm) {
	const wrapper = frm && frm.page && toElement(frm.page.wrapper);
	const head = wrapper && wrapper.querySelector(".page-head");
	if (!head || !frm.doc) return;
	const tags = computeTags(frm, head);
	head.querySelectorAll("[" + ATTR + "]").forEach((el) => {
		if (!tags.has(el)) setAttr(el, ATTR, null);
	});
	tags.forEach((value, el) => setAttr(el, ATTR, value));
}

// One guarded observer per page wrapper. The Amend check is asynchronous,
// workflow items arrive after a promise, and a dirty form resets the actions
// without a refresh. Our own writes are not observed: only childList changes and
// data-label attributes trigger a pass, and passes are coalesced into one frame.
function observe(frm) {
	const wrapper = frm && frm.page && toElement(frm.page.wrapper);
	if (!wrapper || observers.has(wrapper) || !window.MutationObserver) return;
	let scheduled = false;
	const run = () => {
		scheduled = false;
		try {
			tagActions(frm);
		} catch (error) {
			warn("actions", error);
		}
	};
	const observer = new MutationObserver(() => {
		if (scheduled) return;
		scheduled = true;
		(window.requestAnimationFrame || window.setTimeout)(run);
	});
	observer.observe(wrapper, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ["data-label"],
	});
	observers.set(wrapper, observer);
}

export function initActions() {
	if (!window.jQuery) return;
	jQuery(document).on("form-refresh.ins_shell_actions", (event, frm) => {
		try {
			tagActions(frm);
			observe(frm);
		} catch (error) {
			warn("actions", error);
		}
	});
}
