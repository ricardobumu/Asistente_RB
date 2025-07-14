const http = require("http");

const options = {
  hostname: "127.0.0.1",
  port: 3000,
  path: "/",
  method: "GET",
  family: 4, // Force IPv4
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);

  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    console.log("Response:", data);
  });
});

req.on("error", (e) => {
  console.error(`Error: ${e.message}`);
  console.error(`Error code: ${e.code}`);
  console.error(`Error details:`, e);
});

req.setTimeout(5000, () => {
  console.error("Request timeout");
  req.destroy();
});

req.end();
