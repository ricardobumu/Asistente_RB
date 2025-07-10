// scripts/simpleServerTest.js
// Test simple del servidor usando http nativo

const http = require("http");

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 3000,
      path: path,
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: jsonData,
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: data,
          });
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    req.end();
  });
}

async function testServer() {
  console.log("🧪 PROBANDO SERVIDOR CON HTTP NATIVO\n");

  const tests = [
    { name: "Health Check", path: "/health" },
    { name: "API Health", path: "/api/health" },
    { name: "Todos los servicios", path: "/api/services/" },
    { name: "Servicios activos", path: "/api/services/active" },
    { name: "Estadísticas", path: "/api/services/stats" },
    { name: "Categorías", path: "/api/services/categories" },
    { name: "Búsqueda", path: "/api/services/search?q=corte" },
    { name: "Lista paginada", path: "/api/services/list?page=1&limit=3" },
  ];

  for (const test of tests) {
    console.log(`📋 ${test.name}: ${test.path}`);

    try {
      const result = await makeRequest(test.path);

      if (result.status === 200) {
        console.log(`✅ Status: ${result.status}`);

        if (result.data && typeof result.data === "object") {
          if (result.data.success !== undefined) {
            console.log(`📊 Success: ${result.data.success}`);
          }

          if (result.data.data && Array.isArray(result.data.data)) {
            console.log(`📊 Items: ${result.data.data.length}`);
          }

          if (result.data.count !== undefined) {
            console.log(`📊 Count: ${result.data.count}`);
          }
        }
      } else {
        console.log(`❌ Status: ${result.status}`);
        if (result.data && result.data.error) {
          console.log(`❌ Error: ${result.data.error}`);
        }
      }
    } catch (error) {
      console.log(`💥 Error: ${error.message}`);
    }

    console.log("");
  }

  console.log("🎉 Tests completados!");
}

if (require.main === module) {
  testServer();
}

module.exports = { testServer };
