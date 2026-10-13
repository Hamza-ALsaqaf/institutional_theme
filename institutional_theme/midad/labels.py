"""Human-readable names for the tokens that appear in contrast pairs.

The settings validation (ADR 0005) names every failing pair for an administrator, in Arabic or
English, so a raw token such as `on-primary` is never shown on its own.

This module never imports Frappe. Every English source string below is passed through `_()`, an
identity marker, so extraction tools find the strings. The caller (the Settings doctype) translates
at the point of use with `frappe._(label)`. The scribe adds each string to
`institutional_theme/translations/ar.csv`; `all_strings()` returns the complete list.
"""

from __future__ import annotations


def _(text: str) -> str:
	"""Translation marker. Returns the source string unchanged; the caller translates it."""
	return text


MODE_LABELS: dict[str, str] = {
	"light": _("Light"),
	"dark": _("Dark"),
}

# The colour the administrator should adjust, named after the input field it comes from.
INPUT_LABELS: dict[str, str] = {
	"primary": _("primary"),
	"accent": _("accent"),
}

TOKEN_LABELS: dict[str, str] = {
	"surface-base": _("Page background"),
	"surface-sunken": _("Sidebar and well background"),
	"surface-raised": _("Card background"),
	"surface-overlay": _("Menu and dialog background"),
	"surface-hover": _("Hover background"),
	"surface-active": _("Pressed background"),
	"surface-selected": _("Selected row background"),
	"surface-selected-strong": _("Selected and hovered row background"),
	"surface-field": _("Input background"),
	"surface-fill": _("Secondary button background"),
	"surface-disabled": _("Disabled control background"),
	"surface-inverse": _("Tooltip background"),
	"text-strong": _("Heading text"),
	"text": _("Body text"),
	"text-secondary": _("Secondary text"),
	"text-muted": _("Help text"),
	"text-placeholder": _("Placeholder text"),
	"text-disabled": _("Disabled text"),
	"text-inverse": _("Tooltip text"),
	"text-link": _("Link text"),
	"text-link-hover": _("Link text on hover"),
	"text-brand": _("Brand text"),
	"border-control": _("Input border"),
	"border-control-hover": _("Input border on hover"),
	"primary": _("Primary action"),
	"primary-hover": _("Primary action on hover"),
	"primary-active": _("Primary action when pressed"),
	"on-primary": _("Text on primary action"),
	"primary-text": _("Primary-coloured text"),
	"primary-subtle": _("Tinted primary background"),
	"danger": _("Destructive action"),
	"danger-hover": _("Destructive action on hover"),
	"on-danger": _("Text on destructive action"),
	"accent": _("Accent rule and marker"),
	"accent-text": _("Accent text"),
	"accent-subtle": _("Accent background"),
	"focus": _("Focus ring"),
	"mark-bg": _("Search highlight"),
	"status-neutral-bg": _("Neutral status background"),
	"status-neutral-fg": _("Neutral status text"),
	"status-neutral-solid": _("Neutral status mark"),
	"status-muted-bg": _("Muted status background"),
	"status-muted-fg": _("Muted status text"),
	"status-muted-solid": _("Muted status mark"),
	"status-progress-bg": _("In-progress status background"),
	"status-progress-fg": _("In-progress status text"),
	"status-progress-solid": _("In-progress status mark"),
	"status-info-bg": _("Information status background"),
	"status-info-fg": _("Information status text"),
	"status-info-solid": _("Information status mark"),
	"status-teal-bg": _("Teal status background"),
	"status-teal-fg": _("Teal status text"),
	"status-teal-solid": _("Teal status mark"),
	"status-success-bg": _("Success status background"),
	"status-success-fg": _("Success status text"),
	"status-success-solid": _("Success status mark"),
	"status-pending-bg": _("Pending status background"),
	"status-pending-fg": _("Pending status text"),
	"status-pending-solid": _("Pending status mark"),
	"status-warning-bg": _("Warning status background"),
	"status-warning-fg": _("Warning status text"),
	"status-warning-solid": _("Warning status mark"),
	"status-danger-bg": _("Danger status background"),
	"status-danger-fg": _("Danger status text"),
	"status-danger-solid": _("Danger status mark"),
	"status-special-bg": _("Amended status background"),
	"status-special-fg": _("Amended status text"),
	"status-special-solid": _("Amended status mark"),
	"status-plum-bg": _("Plum status background"),
	"status-plum-fg": _("Plum status text"),
	"status-plum-solid": _("Plum status mark"),
	"status-ink-bg": _("Ink status background"),
	"status-ink-fg": _("Ink status text"),
	"feedback-info-bg": _("Information banner background"),
	"feedback-info-fg": _("Information banner text"),
	"feedback-success-bg": _("Success banner background"),
	"feedback-success-fg": _("Success banner text"),
	"feedback-warning-bg": _("Warning banner background"),
	"feedback-warning-fg": _("Warning banner text"),
	"feedback-pending-bg": _("Pending banner background"),
	"feedback-pending-fg": _("Pending banner text"),
	"feedback-danger-bg": _("Error banner background"),
	"feedback-danger-fg": _("Error banner text"),
	"chart-1": _("Chart series 1"),
	"chart-2": _("Chart series 2"),
	"chart-3": _("Chart series 3"),
	"chart-4": _("Chart series 4"),
	"chart-5": _("Chart series 5"),
	"chart-6": _("Chart series 6"),
	"chart-7": _("Chart series 7"),
	"chart-8": _("Chart series 8"),
	"chart-grid": _("Chart gridlines"),
	"chart-label": _("Chart labels"),
	"--disabled-text-color": _("Read-only value text"),
	"--error-border": _("Error border"),
	"--icon-stroke": _("Icons"),
	"--scrollbar-thumb-color": _("Scrollbar thumb"),
	"--scrollbar-track-color": _("Scrollbar track"),
}


def token_label(token: str) -> str:
	"""English source label of a token. Falls back to the token name for an unlabelled token."""
	return TOKEN_LABELS.get(token, token)


def mode_label(mode: str) -> str:
	"""English source label of a mode (`light` or `dark`)."""
	return MODE_LABELS.get(mode, mode)


def input_label(name: str | None) -> str:
	"""English source label of the input to adjust (`primary` or `accent`); empty when unknown."""
	return INPUT_LABELS.get(name or "", "")


def all_strings() -> list[str]:
	"""Every English source string defined here, in a stable order, for the translation file."""
	return [*MODE_LABELS.values(), *INPUT_LABELS.values(), *TOKEN_LABELS.values()]
