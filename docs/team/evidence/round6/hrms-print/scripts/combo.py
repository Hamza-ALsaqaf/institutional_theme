import frappe,sys,subprocess
frappe.init(site=sys.argv[1], sites_path="."); frappe.connect(); frappe.set_user("Administrator")
dt,name,fmt=sys.argv[2:5]
print({k:frappe.db.get_value("Print Format",fmt,k) for k in ("margin_top","margin_bottom","margin_left","margin_right","pdf_generator")})
for style,lh in [("Standard","Midad"),("Midad","Company Letterhead"),("Standard","Company Letterhead"),("Midad","Midad"),("Midad",None)]:
    kw={"style":style}
    if lh: kw["letterhead"]=lh
    else: kw["no_letterhead"]=1
    pdf=frappe.get_print(dt,name,print_format=fmt,as_pdf=True,pdf_generator="chrome",pdf_options={"page-size":"A4"},**kw)
    f=f"/tmp/hp/combo_{style}_{lh}.pdf".replace(" ","_"); open(f,"wb").write(pdf)
    t=subprocess.run(["pdftotext","-layout",f,"-"],capture_output=True,text=True).stdout
    print(style,lh,"TITLE" if "Sal Slip/" in t or "Quotation" in t else "NO-TITLE")
