"""`update_website_context`: link the palette and font stylesheets in `<head>` (ADR 0003, 0004).

The desk's `<head>` holds only the `app_include_css` links and paints before any script runs, so the
server picks the palette and links its file. The whole body is guarded: on any failure nothing is
linked and the user sees the `midad` palette. Lists are always rebuilt, never appended in place,
because `web_include_css` is the worker's cached hooks list.
"""

from __future__ import annotations

import frappe

from institutional_theme import preferences, site_files

DESK_TEMPLATE = "www/desk.html"


def desk_links(user: str) -> list[str]:
	links: list[str] = []
	url = site_files.palette_url(preferences.get_effective(user)["palette"])
	if url:
		links.append(url)
	links.extend(site_files.font_links())
	return links


def site_links() -> list[str]:
	links: list[str] = []
	url = site_files.palette_url(preferences.site_default_palette())
	if url:
		links.append(url)
	links.extend(site_files.font_links())
	return links


def update_website_context(context) -> dict | None:
	try:
		if context.get("template") == DESK_TEMPLATE:
			current = context.get("app_include_css")
			if not isinstance(current, list):
				return None
			links = desk_links(frappe.session.user)
			return {"app_include_css": [*current, *links]} if links else None
		current = context.get("web_include_css")
		if not isinstance(current, list | tuple):
			return None
		links = site_links()
		return {"web_include_css": [*current, *links]} if links else None
	except Exception:
		frappe.log_error(title="Institutional Theme: stylesheet links", defer_insert=True)
		return None
