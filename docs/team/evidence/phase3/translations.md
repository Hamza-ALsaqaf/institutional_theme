# ar.csv check (Phase 3 translations)

Generated from `institutional_theme/translations/ar.csv` (219 rows after this run) by a read-only check: csv parse, placeholder comparison, and a sweep of wrapped strings. Inputs: the Strings sections of `docs/team/evidence/phase3/runtime/evidence.md`, `docs/team/evidence/phase3/css-form/evidence.md`, `docs/team/evidence/phase3/web/evidence.md` and `docs/team/evidence/phase3/css-shell/evidence.md`; the wrapped-string sweep of `institutional_theme/` (`.py`, `.js`, `.html`); the `label` and `description` values in `institutional_theme/institutional_theme/doctype/*/*.json` and `page/*/*.json`; core Arabic in `/home/user/frappe-bench/apps/frappe/frappe/locale/ar.po`; ADR 0002 (Arabic for the Appearance page and API messages) and ADR 0008 (Approve and Reject).

## Counts

| Item | Count |
|---|---|
| Rows in `ar.csv` before this run (committed) | 192 |
| Rows added (new source strings) | 27 |
| Rows changed (existing translation edited) | 17 |
| Rows in `ar.csv` after this run | 219 |
| Rows with 2 columns | 219 of 219 |
| Rows with 3 columns | 0 |
| Duplicate source strings | 0 |
| Rows with an empty source or translation | 0 |
| Rows with `{n}` placeholders in the source | 16 |
| Placeholder mismatches between source and translation | 0 |
| Rows with HTML tags | 0 |

## Rows added

Source strings, all verified to be absent from core `ar.po` with a different Arabic, or absent from core entirely:

Api and runtime: "The colour preset {0} is not available on this site.", "Density must be Comfortable or Compact."
Appearance page: "Appearance", "Mode", "Automatic", "Density", "Colour preset", "Apply colour preset", "Selected", "Set by your administrator.", "Mode changed to {0}.", "Density changed to {0}.", "Colour preset changed to {0}."
Shell: "Approve" (ADR 0008), "Reject" (ADR 0008), "Hidden for your role"
Web: "Production", "Quote this reference when you contact support.", "Time of error", "Technical support", "Release {0}", "Access to this system is restricted to authorised users. Activity is recorded."
Palette labels (`midad/labels.py`): "Field background", "Field background on grey", "Disabled control background in forms", "Disabled input background", "Secondary button background on hover"

## Rows changed

Term: the colour preset is "مجموعة الألوان" everywhere ("نمط الألوان" removed). Density adjectives follow ADR 0002: "مريحة" and "مضغوطة".

| Source | Before | After |
|---|---|---|
| Allow Forest | السماح بنمط غابي | السماح بمجموعة الألوان غابي |
| Allow Graphite | السماح بنمط جرافيت | السماح بمجموعة الألوان جرافيت |
| Allow Midad ink | السماح بنمط مداد | السماح بمجموعة الألوان مداد |
| Allow Petrol | السماح بنمط بترولي | السماح بمجموعة الألوان بترولي |
| Allow Plum | السماح بنمط برقوقي | السماح بمجموعة الألوان برقوقي |
| Allow a custom colour preset | السماح بنمط ألوان مخصص | السماح بمجموعة ألوان مخصصة |
| Custom | مخصص | مخصصة |
| custom | مخصص | مخصصة |
| Comfortable | مريح | مريحة |
| Compact | مضغوط | مضغوطة |
| Custom colour preset | نمط الألوان المخصص | مجموعة الألوان المخصصة |
| Custom colour preset rejected | رُفض نمط الألوان المخصص | رُفضت مجموعة الألوان المخصصة |
| Custom colour preset rejected. These pairs are below their minimum contrast: | رُفض نمط الألوان المخصص. الأزواج التالية أقل من الحد الأدنى للتباين: | رُفضت مجموعة الألوان المخصصة. الأزواج التالية أقل من الحد الأدنى للتباين: |
| Default colour preset | نمط الألوان الافتراضي | مجموعة الألوان الافتراضية |
| The colour preset {0} is not available. | نمط الألوان {0} غير متاح. | مجموعة الألوان {0} غير متاحة. |
| The default colour preset {0} must also be allowed. | يجب أيضًا السماح بنمط الألوان الافتراضي {0}. | يجب أيضًا السماح بمجموعة الألوان الافتراضية {0}. |
| Used by every user who has not chosen another preset. | يستخدمه كل مستخدم لم يختر نمطًا آخر. | يستخدمه كل مستخدم لم يختر مجموعة ألوان أخرى. |

## Overrides of core wording

These apply desk-wide, because the row is keyed on the source string. Core's Arabic is shown for comparison.

| Source | Core `ar.po` | `ar.csv` (this app) | Row status |
|---|---|---|---|
| Light | ضوء | فاتح | already in `ar.csv`, unchanged |
| Dark | مظلم | داكن | already in `ar.csv`, unchanged |
| Automatic | معادلة | تلقائي | added this run |
| Draft | مشروع | مسودة | already in `ar.csv`, unchanged |
| Submitted | مسجلة | مُرحَّل | already in `ar.csv`, unchanged |
| Cancelled | ألغيت | ملغى | already in `ar.csv`, unchanged |
| Completed | أكتمل | مكتمل | already in `ar.csv`, unchanged |

## Core wording used, no row added

Core `ar.po` already holds the Arabic this app would write, so no row was added:

| Source | Core `ar.po` |
|---|---|
| Language | اللغة |
| Reference | مرجع |
| Submit | تسجيل |
| Cancel | إلغاء |
| Amend | تعديل |
| Delete | حذف |

## Sweep result

- Wrapped strings and JSON label/description values: 151 distinct source strings.
- Without an entry in `ar.csv` after this run: 6 (Language, Reference, Submit, Cancel, Amend, Delete). All six are covered by core `ar.po` (table above), so they are listed here and not as missing.
- Without any Arabic entry (core or app): 0.

## Corrections to the earlier evidence

- `docs/team/evidence/phase3/web/evidence.md` states that `ar.csv` already holds an entry for every web string. That was not true for this committed file: "Production", "Quote this reference when you contact support.", "Time of error", "Technical support", "Release {0}" and the authorised-use notice had no entry. They are added in this run. "Language" and "Reference" are covered by core.
- The previous version of this file reported that core `ar.csv` was not found. Core Arabic is in `ar.po`, and it was read from there.
