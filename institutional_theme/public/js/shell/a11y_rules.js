// Accessible-name rules for core markup that axe-core reports (WCAG 1.3.1, 2.4.4, 4.1.2). Attributes only:
// no node is added, moved or removed, no core class or function is touched, and no network call is made.
// `a11y_names.js` decides when a rule runs; this file holds what each rule writes and the 16.32.0 source line
// each one depends on (docs/team/evidence/round3/a11y-attrs/README.md lists them with the strings).
//
// Two guards apply to every write. An attribute that core or an administrator already set is never replaced:
// this module only writes onto an empty attribute or one whose value it wrote itself (so a changed tooltip or
// a toggled state is followed, and a name core adds in a later release wins). And a rule runs only for the
// element class named in `select`, so an unrelated button is never given a guessed name.
import { setAttr } from "./dom.js";
import { labelWrapper } from "./field_labels.js";

// element -> { attribute: value this module last wrote }
const written = new WeakMap();

function mayWrite(element, name) {
	const current = element.getAttribute(name);
	if (current === null) return true;
	const own = written.get(element);
	return !!own && own[name] === current;
}

function put(element, name, value) {
	if (!element || value === null || value === undefined || !mayWrite(element, name)) return;
	const own = written.get(element) || {};
	own[name] = value;
	written.set(element, own);
	setAttr(element, name, value);
}

const translate = (text, args, context) => (typeof __ === "function" ? __(text, args, context) : text);
const clean = (text) => (text || "").replace(/\s+/g, " ").trim();
const hasName = (element) => element.hasAttribute("aria-labelledby");

// No text of its own: an icon (svg or img) is the only content.
function iconOnly(element) {
	return clean(element.textContent) === "" && !!element.querySelector("svg, img");
}

// The tooltip text core keeps in `data-original-title` once Bootstrap has moved `title` (or `title` itself).
function tooltipOf(element) {
	return clean(element.getAttribute("data-original-title")) || clean(element.getAttribute("title"));
}

function isOpen(button) {
	const state = button.getAttribute("data-state");
	if (state) return state === "opened";
	const use = button.querySelector("use");
	return !!use && /chevron-down$/.test(use.getAttribute("href") || "");
}

// Labels by element class. Each entry: the class (selector the element must match) and the string.
// Order matters only for elements that match two entries; none do.
const BUTTONS = [
	// widgets/links_widget.js:31 opens a popover with the card description
	[".card-description-btn", () => translate("Description")],
	// list/base_list.js:1310 dropdown of the two match types (Equals, Like)
	[".match-type-dropdown-btn", () => translate("Match type")],
	// widgets/chart_widget.js:514 dropdown of chart actions
	[".chart-menu", () => translate("Menu")],
	// ui/user_onboarding/OnboardingPanel.vue:237-238: toggleCollapse, then close
	[".onb-header-actions > button:first-child", () => translate("Minimize")],
	[".onb-header-actions > button:last-child", () => translate("Close")],
	// dom.js:354
	[".btn-modal-close", () => translate("Close")],
	// form/templates/form_footer.html:6 calls frappe.utils.scroll_page_to_top()
	[".scroll-to-top", () => translate("Scroll to top")],
	// form/templates/form_sidebar.html:92,108,136; each opens its own dialog (assign_to.js:7,
	// attachments.js:14, share.js:27)
	[".add-assignment-btn", () => translate("Assign")],
	[".add-attachment-btn", () => translate("Add Attachment")],
	[".share-doc-btn", () => translate("Share")],
	// ui/tags.js:21
	[".add-tags-btn", () => translate("Add Tags")],
];

function buttonLabel(button) {
	const tip = tooltipOf(button);
	if (tip) return tip;
	for (const [select, label] of BUTTONS) {
		if (button.matches(select)) return label();
	}
	// views/workspace/workspace.js:220 adds an ellipsis icon button to the page icon group and wires a
	// menu to it (create_menu), with its tooltip removed.
	if (button.parentElement && button.parentElement.classList.contains("page-icon-group") && button.querySelector("use[href$='icon-ellipsis']")) {
		return translate("Menu");
	}
	return null;
}

function nameButton(button) {
	if (hasName(button) || !iconOnly(button)) return;
	put(button, "aria-label", buttonLabel(button));
}

// ui/sidebar/sidebar_header.html:17: the chevron inside the header link; the header opens the app switcher menu
// (sidebar_header.js `setup_app_switcher`, create_menu on the header wrapper).
function nameHeaderButton(button) {
	if (hasName(button) || !iconOnly(button)) return;
	put(button, "aria-label", translate("Menu"));
}

// ui/sidebar/sidebar_item.js:252 `enable_collapsible`; a click anywhere on the row toggles it (:285), and
// `toggle()` (:207) writes data-state and the chevron.
function nameSectionToggle(button) {
	if (hasName(button) || !iconOnly(button)) return;
	const anchor = button.closest(".item-anchor");
	const label = anchor && anchor.querySelector(".sidebar-item-label");
	const name = label ? clean(label.textContent) : "";
	if (!name) return;
	put(button, "aria-label", isOpen(button) ? translate("Collapse {0}", [name]) : translate("Expand {0}", [name]));
}

// form/tab.js:31 writes <li class="nav-item"> under <ul role="tablist"> (form/layout.js:46); the li has no
// role of its own, so the tab button's parent is a list item rather than the tablist.
function presentTabItem(item) {
	put(item, "role", "presentation");
}

// views/breadcrumbs.js:282: the first breadcrumb is an icon-only link to /desk.
function nameHomeLink(link) {
	if (link.hasAttribute("aria-labelledby") || clean(link.textContent) !== "" || !link.querySelector("svg")) return;
	put(link, "aria-label", translate("Home"));
}

// ui/sidebar/sidebar_header.html:3-4 inserts the app icon without alt, next to the visible app title.
function decorateLogo(image) {
	const header = image.closest(".sidebar-header");
	const title = header && header.querySelector(".header-title");
	if (!title || !clean(title.textContent)) return;
	put(image, "alt", "");
}

// list/list_view.js:2706 creates the row checkbox with no name. The row title is the subject link rendered
// next to it; the document name is added when it differs, because two rows can share a title.
function nameListRow(check) {
	const subject = check.closest(".list-subject");
	const link = subject && subject.querySelector("a[data-name]");
	const name = clean(check.getAttribute("data-name"));
	const title = clean(link && (link.getAttribute("title") || link.textContent));
	const target = title && name && title !== name ? `${title} (${name})` : title || name;
	put(check, "aria-label", target ? translate("Select {0}", [target]) : translate("Select row"));
}

// frappe-datatable (node_modules/frappe-datatable/src/datamanager.js:387,624) renders `<input type="checkbox">`
// in the first column of the header row and of each data row; the cell carries data-is-header or data-row-index.
function nameDatatableCheckbox(check) {
	if (hasName(check) || check.getAttribute("title")) return;
	const cell = check.closest(".dt-cell");
	if (!cell) return;
	if (cell.hasAttribute("data-is-header")) {
		put(check, "aria-label", translate("Select all rows"));
		return;
	}
	const index = parseInt(cell.getAttribute("data-row-index"), 10);
	put(check, "aria-label", Number.isNaN(index) ? translate("Select row") : translate("Select row {0}", [index + 1]));
}

// ui/filters/edit_filter.html:10 (condition select), filter.js builds the field-name awesomplete input and
// the value control (`only_input`, no label).
function nameFilterField(control) {
	if (hasName(control) || clean(control.getAttribute("title")) || control.closest("label")) return;
	let label;
	if (control.matches("select.condition")) label = translate("Condition", null, "Filter");
	else if (control.closest(".fieldname-select-area")) label = translate("Field");
	else label = translate("Value");
	put(control, "aria-label", label);
}

// Dialog fields are built like form fields (label.control-label, no `for`); field_labels.js covers form
// layouts only, so the same rule runs for controls inside a modal.
function labelDialogControl(wrapper) {
	labelWrapper(wrapper);
}

export const RULES = [
	{ select: "ul[role='tablist'] > li.nav-item", apply: presentTabItem },
	{ select: ".navbar-breadcrumbs > li:first-child > a", apply: nameHomeLink },
	{ select: ".sidebar-header .header-logo > img", apply: decorateLogo },
	{ select: ".sidebar-header > button.drop-icon", apply: nameHeaderButton },
	{ select: ".item-anchor > .sidebar-item-control > button.drop-icon", apply: nameSectionToggle },
	{ select: "button", apply: nameButton },
	{ select: "input.list-row-checkbox", apply: nameListRow },
	{ select: ".dt-cell input[type='checkbox']", apply: nameDatatableCheckbox },
	{
		select: ".filter-box select.condition, .filter-box .fieldname-select-area input, .filter-box .filter-field input:not([type='hidden']):not([type='checkbox']), .filter-box .filter-field select, .filter-box .filter-field textarea",
		apply: nameFilterField,
	},
	{ select: ".modal .frappe-control", apply: labelDialogControl },
];

export const ALL = RULES.map((rule) => rule.select).join(",");

// Runs every rule whose selector the element matches. `button` is the only wide selector; the rest are
// anchored on a class core writes.
export function applyRules(element) {
	for (const rule of RULES) {
		if (element.matches(rule.select)) rule.apply(element);
	}
}

// Attribute changes that can change a name: a tooltip text moved by Bootstrap, the sidebar toggle state.
export const ATTRIBUTES = ["data-original-title", "title", "data-state"];
