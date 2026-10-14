import sys, runpy
from frappe.utils.pdf_generator import browser as b
cls = [v for v in vars(b).values() if isinstance(v, type) and hasattr(v, "prepare_options_for_pdf")][0]
orig = cls.prepare_options_for_pdf
def patched(self):
    orig(self)
    print("DBG header_height", getattr(self, "header_height", None), "opts", {k: v for k, v in self.options.items() if "margin" in k or "page" in k or "header" in k})
    if self.header_page: print("DBG header_page.options", {k:v for k,v in self.header_page.options.items() if k.startswith(("margin","paper"))})
cls.prepare_options_for_pdf = patched
og = cls.get_rendered_header_footer
def dump(self, content, type, *a, **k):
    h = og(self, content, type, *a, **k)
    open(f"/tmp/hf-{type}.html", "w").write(h)
    return h
cls.get_rendered_header_footer = dump
sys.argv = sys.argv[1:]
runpy.run_path(sys.argv[0], run_name="__main__")
