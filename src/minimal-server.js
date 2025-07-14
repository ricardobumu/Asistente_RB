const http = require("http");

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  res.writeHead(200, { "Content-Type": "application/json" });

  if (req.url === "/health") {
    res.end(
      JSON.stringify({
        status: "OK",
        message: "Ricardo Beauty Assistant funcionando",
        timestamp: new Date().toISOString(),
      })
    );
  } else if (req.url === "/") {
    res.end(
      JSON.stringify({
        message: "Ricardo Beauty Assistant - ngrok test",
        timestamp: new Date().toISOString(),
        endpoints: ["/health", "/webhook/whatsapp", "/webhook/calendly"],
      })
    );
  } else {
    res.end(
      JSON.stringify({
        message: "Endpoint disponible",
        url: req.url,
        timestamp: new Date().toISOString(),
      })
    );
  }
});

const PORT = 3000;

server.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log("🚀 SERVIDOR MINIMO INICIADO");
  console.log("=".repeat(50));
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log("=".repeat(50));
  console.log("✅ Listo para ngrok!");
  console.log("🔗 Ejecuta: ngrok http 3000");
  console.log("=".repeat(50));
});

server.on("error", (err) => {
  console.error("❌ Error del servidor:", err.message);
});
