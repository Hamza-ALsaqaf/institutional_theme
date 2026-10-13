app_name = "institutional_theme"
app_title = "Institutional Theme"
app_publisher = "Hamza ALsaqaf"
app_description = "Midad: an upgrade-safe institutional visual identity and UI theme for the Frappe / ERPNext v16 desk"
app_email = ""
app_license = "mit"

# Skeleton only. Nothing is included in the desk yet, so installing this app
# changes nothing. The build team adds the hooks below as each piece lands
# (see docs/team/WORKFLOW.md). Keep this list in sync with
# docs/DEPENDENCY_MANIFEST.md.
#
# A bundle name that is missing from sites/assets/assets.json is emitted as a
# broken <link>, not skipped, so add an include only together with its source
# file under institutional_theme/public/.

# Desk
# app_include_css = ["ins_desk.bundle.css"]
# app_include_js = ["ins_shell.bundle.js"]

# Website, login, portal
# web_include_css = ["ins_web.bundle.css"]
# update_website_context = "institutional_theme.website.update_website_context"

# Email (inlined by Premailer: no custom properties, no @font-face)
# email_css = ["ins_email.bundle.css"]

# Boot info for the desk shell (palette, density, environment label)
# extend_bootinfo = "institutional_theme.boot.extend_bootinfo"

# Install / migrate / uninstall. All of them must be idempotent and must never
# overwrite a value an administrator has changed.
# after_install = "institutional_theme.install.after_install"
# after_migrate = "institutional_theme.install.after_migrate"
# before_uninstall = "institutional_theme.install.before_uninstall"
