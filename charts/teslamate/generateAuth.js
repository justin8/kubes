const pass = require("pass");
const fs = require("fs");
const path = require("path");

let secrets = require("./secrets.json");

console.log("Generating htpasswd auth for teslamate...")
pass.generate(secrets.PASSWORD, function (err, hash) {
  if (err) {
    console.log(err);
  } else {
    secrets.auth = `${secrets.USER}:${hash}`
    fs.writeFile(
      path.join(__dirname, "secrets.json"),
      JSON.stringify(secrets, null, 2),
      function (err) {
        if (err) {
          console.log(err);
        }
      }
    );
  }
});
