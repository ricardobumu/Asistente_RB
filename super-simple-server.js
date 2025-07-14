// Servidor súper simple para ngrok
const http = require("http");

console.log("🚀 Iniciando servidor...");

const server = http.createServer((req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`📞 Petición recibida: ${req.method} ${req.url} - ${timestamp}`);

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });

  const response = {
    status: "✅ FUNCIONANDO",
    message: "Ricardo Beauty Assistant - Servidor de Prueba",
    timestamp: timestamp,
    url: req.url,
    method: req.method,
    headers: req.headers,
  };

  res.end(JSON.stringify(response, null, 2));
});

const PORT = 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║                 🎉 SERVIDOR INICIADO                   ║");
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log(`║  📍 URL Local:  http://localhost:${PORT}                ║`);
  console.log(`║  🌍 IP:         http://0.0.0.0:${PORT}                  ║`);
  console.log(`║  ⏰ Hora:       ${new Date().toLocaleString()}       ║`);
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log("║  🔗 Para ngrok: ngrok http 3000                       ║");
  console.log("║  🚀 LISTO PARA RECIBIR CONEXIONES                     ║");
  console.log("╚════════════════════════════════════════════════════════╝");
});

server.on("error", (err) => {
  console.error("❌ ERROR DEL SERVIDOR:", err.message);
  if (err.code === "EADDRINUSE") {
    console.error(`⚠️  El puerto ${PORT} ya está en uso.`);
    console.error(
      "💡 Solución: Termina el proceso que usa el puerto o cambia el puerto."
    );
  }
});

// Manejar cierre graceful
process.on("SIGINT", () => {
  console.log("\n🛑 Cerrando servidor...");
  server.close(() => {
    console.log("✅ Servidor cerrado correctamente");
    process.exit(0);
  });
});
