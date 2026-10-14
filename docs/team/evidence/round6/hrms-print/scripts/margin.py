import frappe,sys,subprocess
frappe.init(site=sys.argv[1], sites_path="."); frappe.connect(); frappe.set_user("Administrator")
dt,name,fmt=sys.argv[2:5]
src=frappe.get_doc("Print Format",fmt)
try:
  for mt in (0,5,10,15):
    n=f"Zz Margin Test {mt}"
    if frappe.db.exists("Print Format",n): frappe.delete_doc("Print Format",n,force=1)
    d=frappe.copy_doc(src); d.name=n; d.standard="No"; d.margin_top=mt; d.insert()
    for style,lh in (("Midad","Midad"),("Standard","Company Letterhead")):
        pdf=frappe.get_print(dt,name,print_format=n,as_pdf=True,pdf_generator="chrome",pdf_options={"page-size":"A4"},style=style,letterhead=lh)
        f=f"/tmp/hp/mg_{mt}_{style}.pdf"; open(f,"wb").write(pdf)
        t=subprocess.run(["pdftotext","-layout",f,"-"],capture_output=True,text=True).stdout
        print(mt,style,lh,"TITLE" if "Sal Slip/" in t else "NO-TITLE")
finally:
  for mt in (0,5,10,15):
    n=f"Zz Margin Test {mt}"
    if frappe.db.exists("Print Format",n): frappe.delete_doc("Print Format",n,force=1)
  frappe.db.commit(); print("left",frappe.db.count("Print Format",{"name":["like","Zz Margin%"]}))
