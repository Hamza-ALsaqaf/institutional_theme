import frappe,sys
frappe.init(site=sys.argv[1], sites_path="."); frappe.connect(); frappe.set_user("Administrator")
dt,name,fmt,style,lh,out=sys.argv[2:8]
kw={"style":style}
if lh=="none": kw["no_letterhead"]=1
else: kw["letterhead"]=lh
h=frappe.get_print(dt,name,print_format=fmt,**kw); open(out,"w").write(h)
