// servidor-webhooks.js - Servidor completo con webhooks
const http = require("http");
const url = require("url");

console.log("🚀 Iniciando servidor de webhooks...");

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // Headers CORS y básicos
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json");

  console.log(`📞 ${method} ${path} - ${new Date().toISOString()}`);

  // Leer body para POST requests
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", () => {
    try {
      const requestData = body ? JSON.parse(body) : {};

      // RUTAS PRINCIPALES
      if (method === "GET" && path === "/") {
        // Página principal
        res.writeHead(200);
        res.end(
          JSON.stringify(
            {
              status: "✅ FUNCIONANDO",
              message: "Ricardo Beauty Assistant - Servidor de Webhooks",
              timestamp: new Date().toISOString(),
              endpoints: {
                health: "/health",
                whatsapp: "/webhook/whatsapp",
                calendly: "/webhook/calendly",
                calendly_api: "/api/calendly/webhook",
              },
            },
            null,
            2,
          ),
        );
      } else if (method === "GET" && path === "/health") {
        // Health check
        res.writeHead(200);
        res.end(
          JSON.stringify(
            {
              status: "OK",
              message: "Servidor funcionando correctamente",
              timestamp: new Date().toISOString(),
              uptime: process.uptime(),
            },
            null,
            2,
          ),
        );
      } else if (method === "POST" && path === "/webhook/whatsapp") {
        // Webhook de WhatsApp (Twilio)
        console.log("📱 WEBHOOK WHATSAPP:", requestData);

        res.writeHead(200);
        res.end(
          JSON.stringify(
            {
              success: true,
              message: "Webhook WhatsApp procesado",
              received: requestData,
              timestamp: new Date().toISOString(),
            },
            null,
            2,
          ),
        );
      } else if (
        method === "POST" &&
        (path === "/webhook/calendly" || path === "/api/calendly/webhook")
      ) {
        // Webhook de Calendly
        console.log("📅 WEBHOOK CALENDLY:", requestData);

        res.writeHead(200);
        res.end(
          JSON.stringify(
            {
              success: true,
              message: "Webhook Calendly procesado",
              received: requestData,
              timestamp: new Date().toISOString(),
            },
            null,
            2,
          ),
        );
      } else if (method === "OPTIONS") {
        // Preflight CORS
        res.writeHead(200);
        res.end();
      } else {
        // 404 - Ruta no encontrada
        res.writeHead(404);
        res.end(
          JSON.stringify(
            {
              error: "Endpoint no encontrado",
              path: path,
              method: method,
              timestamp: new Date().toISOString(),
              available_endpoints: [
                "/",
                "/health",
                "/webhook/whatsapp",
                "/webhook/calendly",
                "/api/calendly/webhook",
              ],
            },
            null,
            2,
          ),
        );
      }
    } catch (error) {
      console.error("❌ Error procesando request:", error);
      res.writeHead(500);
      res.end(
        JSON.stringify(
          {
            error: "Error interno del servidor",
            message: error.message,
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    }
  });
});

const PORT = 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║              🎉 SERVIDOR WEBHOOKS INICIADO             ║");
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log(`║  📍 Local:       http://localhost:${PORT}               ║`);
  console.log(`║  🌍 ngrok:       https://604fc8f718749.ngrok-free.app  ║`);
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log("║  ENDPOINTS DISPONIBLES:                                ║");
  console.log("║  📊 Health:      /health                               ║");
  console.log("║  📱 WhatsApp:    /webhook/whatsapp                     ║");
  console.log("║  📅 Calendly:    /webhook/calendly                     ║");
  console.log("║  📅 Calendly:    /api/calendly/webhook                 ║");
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log("║  🔗 URLs PARA CONFIGURAR:                              ║");
  console.log(
    "║  WhatsApp: https://604fc8f718749.ngrok-free.app/webhook/whatsapp ║",
  );
  console.log(
    "║  Calendly: https://604fc8f718749.ngrok-free.app/api/calendly/webhook ║",
  );
  console.log("╚════════════════════════════════════════════════════════╝");
});

server.on("error", (err) => {
  console.error("❌ ERROR DEL SERVIDOR:", err.message);
});
