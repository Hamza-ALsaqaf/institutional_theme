app_name = "institutional_theme"
app_title = "Institutional Theme"
app_publisher = "Hamza ALsaqaf"
app_description = (
	"Midad: an upgrade-safe institutional visual identity and UI theme for the Frappe / ERPNext v16 desk"
)
app_email = ""
app_license = "mit"

# Each include is enabled only together with its source file and only after the file compiled
# (docs/team/evidence/phase3/runtime/HOOKS_ON.md). Keep this list in sync with
# docs/DEPENDENCY_MANIFEST.md.
#
# A bundle name that is missing from sites/assets/assets.json is emitted as a
# broken <link>, not skipped, so add an include only together with its source
# file under institutional_theme/public/.

# Desk. The mode (Light, Dark, Automatic) stays core's own desk_theme; this bundle carries the midad
# tokens, the mapping onto Frappe's variables and the Plex faces. Other presets, the custom preset
# and other font pairings are linked per user and per site by update_website_context (ADR 0003).
app_include_css = ["ins_desk.bundle.css"]
app_include_js = ["ins_shell.bundle.js"]

# Website, login, portal
web_include_css = ["ins_web.bundle.css"]
update_website_context = [
	"institutional_theme.website.update_website_context",
	"institutional_theme.web_content.update_website_context",
]

# Email (inlined by Premailer: no custom properties, no @font-face)
# email_css = ["ins_email.bundle.css"]

# Boot info for the desk shell (palette, density, environment label)
extend_bootinfo = "institutional_theme.boot.extend_bootinfo"

# Regenerate the per-site stylesheets after the settings are saved (ADR 0004).
doc_events = {
	"Institutional Theme Settings": {"on_update": "institutional_theme.site_files.on_settings_update"},
}

# Install / migrate / uninstall. All of them must be idempotent and must never
# overwrite a value an administrator has changed. Install changes nothing by itself: the theme
# is on as soon as the bundles are built.
after_migrate = "institutional_theme.install.after_migrate"
before_uninstall = "institutional_theme.install.before_uninstall"
