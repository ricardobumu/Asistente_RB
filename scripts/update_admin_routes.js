// Script para actualizar adminBookingRoutes.js
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../src/routes/adminBookingRoutes.js");

// Leer el archivo
let content = fs.readFileSync(filePath, "utf8");

// Reemplazar todas las referencias al controlador
content = content.replace(
  /adminBookingController\./g,
  "adminAppointmentController."
);

// Escribir el archivo actualizado
fs.writeFileSync(filePath, content);

console.log("✅ Archivo adminBookingRoutes.js actualizado exitosamente");
