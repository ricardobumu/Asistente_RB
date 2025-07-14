console.log("Iniciando servidor...");

try {
  const http = require("http");

  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(
      `Ricardo Beauty Assistant is running!
    Time: ${new Date().toISOString()}`,
    );
  });

  server.listen(3000, () => {
    console.log("✅ Servidor corriendo en puerto 3000");
    console.log("🔗 URL: http://localhost:3000");
    console.log("🚀 Listo para ngrok!");
  });

  server.on("error", (err) => {
    console.error("❌ Error:", err);
  });
} catch (error) {
  console.error("❌ Error iniciando servidor:", error);
}
