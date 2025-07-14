// Servidor simple para usar con ngrok
const http = require("http");
const url = require("url");

const PORT = process.env.PORT || 3000;

// Crear servidor HTTP
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  console.log(`${new Date().toISOString()} - ${method} ${req.url}`);

  // Configurar CORS y headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
  res.setHeader("Content-Type", "application/json");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Manejar OPTIONS request
  if (method === "OPTIONS") {
    res.statusCode = 200;
    res.end();
    return;
  }

  // Función para leer el body de la request
  function getRequestBody(callback) {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        const jsonBody = body ? JSON.parse(body) : {};
        callback(null, jsonBody);
      } catch (error) {
        callback(error, null);
      }
    });
  }

  // Rutas del servidor
  if (path === "/" && method === "GET") {
    // Página principal
    res.statusCode = 200;
    res.end(
      JSON.stringify(
        {
          status: "online",
          message: "🎉 Servidor funcionando correctamente",
          timestamp: new Date().toISOString(),
          endpoints: [
            "GET / - Esta página",
            "GET /health - Estado del servidor",
            "POST /webhook/whatsapp - Webhook de WhatsApp",
            "POST /webhook/calendly - Webhook de Calendly",
            "POST /api/calendly/webhook - API de Calendly",
          ],
        },
        null,
        2,
      ),
    );
  } else if (path === "/health" && method === "GET") {
    // Health check
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        status: "healthy",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        port: PORT,
      }),
    );
  } else if (path === "/webhook/whatsapp" && method === "POST") {
    // Webhook de WhatsApp
    getRequestBody((error, body) => {
      if (error) {
        console.error("Error parsing WhatsApp webhook:", error);
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }

      console.log("WhatsApp webhook received:", body);

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: "WhatsApp webhook recibido correctamente",
          received_data: body,
          timestamp: new Date().toISOString(),
        }),
      );
    });
  } else if (
    (path === "/webhook/calendly" || path === "/api/calendly/webhook") &&
    method === "POST"
  ) {
    // Webhook de Calendly
    getRequestBody((error, body) => {
      if (error) {
        console.error("Error parsing Calendly webhook:", error);
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }

      console.log("Calendly webhook received:", body);

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          message: "Calendly webhook recibido correctamente",
          received_data: body,
          timestamp: new Date().toISOString(),
        }),
      );
    });
  } else {
    // Ruta no encontrada
    res.statusCode = 404;
    res.end(
      JSON.stringify({
        error: "Ruta no encontrada",
        path: path,
        method: method,
        available_endpoints: [
          "GET /",
          "GET /health",
          "POST /webhook/whatsapp",
          "POST /webhook/calendly",
          "POST /api/calendly/webhook",
        ],
      }),
    );
  }
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`📱 Listo para recibir webhooks en:`);
  console.log(`   - WhatsApp: http://localhost:${PORT}/webhook/whatsapp`);
  console.log(`   - Calendly: http://localhost:${PORT}/api/calendly/webhook`);
  console.log(`🌐 Si tienes ngrok activo, usa estas URLs:`);
  console.log(`   - WhatsApp: https://tu-url.ngrok-free.app/webhook/whatsapp`);
  console.log(
    `   - Calendly: https://tu-url.ngrok-free.app/api/calendly/webhook`,
  );
  console.log(`\n⚡ Servidor funcionando correctamente`);
});

// Manejo de errores
server.on("error", (error) => {
  console.error("Error del servidor:", error);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n⏹️  Cerrando servidor...");
  server.close(() => {
    console.log("✅ Servidor cerrado correctamente");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("\n⏹️  Cerrando servidor...");
  server.close(() => {
    console.log("✅ Servidor cerrado correctamente");
    process.exit(0);
  });
});
