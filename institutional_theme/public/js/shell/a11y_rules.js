// Accessible-name rules for core markup that axe-core reports (WCAG 1.3.1, 2.4.4, 4.1.2). Attributes only:
// no node is added, moved or removed, no core class or function is touched, and no network call is made.
// `a11y_names.js` decides when a rule runs; this file holds what each rule writes and the 16.32.0 source line
// each one depends on (docs/team/evidence/round3/a11y-attrs/README.md lists them with the strings).
//
// Two guards apply to every write. An attribute that core or an administrator already set is never replaced:
// this module only writes onto an empty attribute or one whose value it wrote itself (so a changed tooltip or
// a toggled state is followed, and a name core adds in a later release wins). And a rule runs only for the
// element class named in `select`, so an unrelated button is never given a guessed name.
import { setAttr, warn } from "./dom.js";
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
	// form/grid_row_form.js:49-51: the icon-only button that closes the row editor (toggle_view)
	[".grid-collapse-row", () => translate("Collapse", null, "Row editor")],
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
// role of its own, so the tab button's parent is a list item rather than the tablist. The same button carries
// role="tab" (tab.js:36) but core's own code writes no aria-selected. The state moves two ways: a click runs
// Bootstrap's tab plugin (form/layout.js:555), which toggles the `active` class and also writes aria-selected on
// role="tab" elements (bootstrap 4.6.2 js/src/tab.js:167-176); other paths use Tab.set_active() (form/tab.js:95-108,
// called from form.js:2120 scroll_to_field), which moves the class only. aria-selected is therefore a pure mirror
// of the `active` class, and it is written with setAttr, not put: a value Bootstrap wrote earlier must not stop the
// mirror from following a later set_active(). A small observer on the tablist (class attribute only, tab buttons
// only) follows each change. The state is exposed; no key behaviour is added.
const watchedTablists = new WeakSet();

function syncTab(button) {
	setAttr(button, "aria-selected", button.classList.contains("active") ? "true" : "false");
}

function presentTabItem(item) {
	put(item, "role", "presentation");
	const button = item.querySelector(":scope > button[role='tab']");
	if (button) syncTab(button);
	const list = item.parentElement;
	if (!list || watchedTablists.has(list) || typeof MutationObserver !== "function") return;
	watchedTablists.add(list);
	new MutationObserver((records) => {
		try {
			for (const record of records) {
				const target = record.target;
				if (target.nodeType === 1 && target.matches("li.nav-item > button[role='tab']")) syncTab(target);
			}
		} catch (error) {
			warn("tab state", error);
		}
	}).observe(list, { attributes: true, subtree: true, attributeFilter: ["class"] });
}

// 16.32.0, views/breadcrumbs.js:282: the first breadcrumb is an icon-only link to /desk, in `ul.navbar-breadcrumbs > li > a`.
// v16.52.0 has no equivalent: its crumbs are `nav.es-breadcrumbs.navbar-breadcrumbs > ol > li > .es-breadcrumbs__item`, the first one is the
// doctype crumb with a label (views/breadcrumbs.js:160-161), and core names any icon-only crumb itself from its title
// (ui/components/breadcrumbs.js:63-67). The selector below therefore matches nothing there, by design.
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

// ui/user_onboarding/OnboardingPanel.vue:248-250: the panel icon (an <img> built from the desktop icon) sits
// next to the visible panel title.
function decorateOnboardingIcon(image) {
	const title = image.closest(".onb-title");
	const text = title && title.querySelector(".text-base");
	if (!text || !clean(text.textContent)) return;
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

// frappe-datatable (node_modules/frappe-datatable/src/datamanager.js:55-68,623) renders the selection
// `<input type="checkbox">` in column 0 of the header row and of each data row (the library itself addresses it
// as `.dt-cell--col-0 [type="checkbox"]`, rowmanager.js:45,127); the cell carries data-is-header or
// data-row-index. Core's Check formatter also writes a checkbox into a cell (`<input type="checkbox" disabled>`,
// frappe/public/js/frappe/form/formatters.js:165-167), and a Check field edited inline sits inside
// `.dt-cell__edit`: those show a field value, not a row selection, so they are never named as one here (see
// nameDatatableValue).
function nameDatatableCheckbox(check) {
	if (check.disabled || check.closest(".dt-cell__edit")) return;
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

// A Check value shown in a report cell is core's disabled checkbox (formatters.js:165-167); it has no label of its
// own, and axe rule `label` rejects it. Its name is the column title (the header cell with the same
// data-col-index) and the row number, so "Enabled, row 3" says what the value is and where it is. A checkbox in the
// header, in column 0 (the selector) or inside an inline editor is not handled here.
function nameDatatableValue(check) {
	if (!check.disabled || check.closest(".dt-cell__edit") || hasName(check) || check.getAttribute("title")) return;
	const cell = check.closest(".dt-cell");
	if (!cell || cell.hasAttribute("data-is-header") || cell.classList.contains("dt-cell--col-0")) return;
	const index = parseInt(cell.getAttribute("data-row-index"), 10);
	const table = cell.closest(".datatable");
	const header = table && table.querySelector(`.dt-cell[data-is-header][data-col-index="${cell.getAttribute("data-col-index")}"] .dt-cell__content`);
	const column = clean(header && (header.getAttribute("title") || header.textContent));
	if (!column) return;
	put(check, "aria-label", Number.isNaN(index) ? column : translate("{0}, row {1}", [column, index + 1]));
}

// frappe-datatable (src/datatable.js:126) writes one off-screen `<textarea class="dt-paste-target">`; cellmanager.js:153-157
// focuses it on paste and reads the pasted text into the cells.
function namePasteTarget(area) {
	if (hasName(area) || clean(area.getAttribute("title"))) return;
	put(area, "aria-label", translate("Paste into table"));
}

// The filter row of the datatable has one `input.dt-filter` per column. Core titles each one "Filter based on
// {column}" in English whatever the language (frappe-datatable src/rowmanager.js:360-363, no translation), and
// leaves the one above the checkbox column disabled and untitled. aria-label outranks title in the accessible
// name, so a translated name is written and core's title is left as it is. The column name is `data-name`
// (written from the column's own name by makeDataAttributeString); the row-number column has none and core's
// text says "Index", so it is named "Row Number" (a string frappe translates). A title that is not core's is
// somebody else's name and is kept.
const CORE_FILTER_TITLE = /^Filter based on /;

function nameDatatableFilter(input) {
	if (hasName(input)) return;
	const title = clean(input.getAttribute("title"));
	if (!title) {
		put(input, "aria-label", translate("Filter", null, "Column filter"));
		return;
	}
	if (!CORE_FILTER_TITLE.test(title)) return;
	const column = clean(input.getAttribute("data-name")) || translate("Row Number");
	put(input, "aria-label", translate("Filter {0}", [column], "Column filter"));
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

// Dialog fields and the child-table row editor are built like form fields (label.control-label, no `for`);
// field_labels.js covers form layouts only, so the same rule runs for controls inside a modal and inside
// `.form-in-grid` (grid_row_form.js:4).
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
	{ select: ".onb-title-icon > img", apply: decorateOnboardingIcon },
	{ select: "input.list-row-checkbox", apply: nameListRow },
	{ select: "textarea.dt-paste-target", apply: namePasteTarget },
	{ select: ".dt-row-filter input.dt-filter, .dt-cell[data-is-filter] input.dt-filter", apply: nameDatatableFilter },
	{ select: ".dt-cell--col-0 input[type='checkbox']:not([disabled])", apply: nameDatatableCheckbox },
	{ select: ".dt-cell:not(.dt-cell--col-0) input[type='checkbox'][disabled]", apply: nameDatatableValue },
	{
		select: ".filter-box select.condition, .filter-box .fieldname-select-area input, .filter-box .filter-field input:not([type='hidden']):not([type='checkbox']), .filter-box .filter-field select, .filter-box .filter-field textarea",
		apply: nameFilterField,
	},
	{ select: ".modal .frappe-control, .form-in-grid .frappe-control", apply: labelDialogControl },
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
