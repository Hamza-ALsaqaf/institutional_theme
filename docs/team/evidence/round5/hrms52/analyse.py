"""Summarise screens/hrms_screens.json (output of tests/browser/hrms_screens.mjs): flagged records and totals."""
import collections
import json
import sys

d = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "screens/hrms_screens.json"))
recs = [r for r in d if r.get("page") and r["page"] != "(page errors)"]
flag = [r for r in recs if r["lowContrastCount"] or r["lightSurfaceCount"] or r["pillFails"] or r["overflowX"] > 0]
bad_side = [r for r in recs if r["sidebarSide"] != "none" and ((r["dir"] == "rtl") != (r["sidebarSide"] == "right"))]
print("records", len(recs), "flagged", len(flag), "sidebar on wrong side", len(bad_side))
print("by combo", dict(collections.Counter(r["combo"] for r in recs)))
print("text elements checked", sum(r["textChecked"] for r in recs), "pills checked", sum(len(r["pills"]) for r in recs))
print("min pill ratio", min((p["ratio"] for r in recs for p in r["pills"]), default=None))
print("sidebar none:", [(r["combo"], r["page"]) for r in recs if r["sidebarSide"] == "none"][:8])
for r in flag:
    print(r["combo"], r["density"], r["page"], "overflow", r["overflowX"], "low", r["lowContrastCount"], "lightSurf", r["lightSurfaceCount"], "pillFails", r["pillFails"])
    for x in r["lowContrast"][:6]:
        print("   LOW", x["sel"], repr(x["text"]), x["ratio"], x["fg"], x["bg"])
    for x in r["lightSurfaces"][:4]:
        print("   LIGHT", x)
    for x in [p for p in r["pills"] if p["ratio"] < 4.5][:4]:
        print("   PILL", x)
for r in d:
    if r.get("page") == "(page errors)":
        print("page errors", r["combo"], r["errors"])
