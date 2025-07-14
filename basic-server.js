const http = require("http");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Server OK - " + new Date().toISOString());
});

server.listen(3000, () => {
  console.log("✅ Server running on http://localhost:3000");
});

server.on("error", (err) => {
  console.error("❌ Server error:", err.message);
});
