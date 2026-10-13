B=http://localhost:8000
curl -s -c adm.jar -X POST $B/api/method/login -H 'Host: midad.test' -d 'usr=Administrator&pwd=admin' | head -c 100; echo
for l in en ar; do for t in Light Dark; do
 e="css-shell-$l-$(echo $t|tr A-Z a-z)@midad.test"
 curl -s -b adm.jar -X POST $B/api/resource/User -H 'Host: midad.test' -H 'Content-Type: application/json' -d "{\"email\":\"$e\",\"first_name\":\"Shell $l $t\",\"send_welcome_email\":0,\"language\":\"$l\",\"desk_theme\":\"$t\",\"new_password\":\"Shell-Test-9172\",\"roles\":[{\"role\":\"System Manager\"},{\"role\":\"Accounts Manager\"},{\"role\":\"Accounts User\"},{\"role\":\"Sales User\"},{\"role\":\"Sales Manager\"}]}" | head -c 150; echo
done; done
