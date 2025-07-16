// Script para actualizar appointmentWidgetController.js
const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "../src/controllers/appointmentWidgetController.js"
);

// Leer el archivo
let content = fs.readFileSync(filePath, "utf8");

// Reemplazos sistemáticos
const replacements = [
  // Comentarios de archivo
  ["bookingWidgetController.js", "appointmentWidgetController.js"],

  // Servicios
  ["bookingWidgetService", "appointmentWidgetService"],

  // Variables
  ["bookingData", "appointmentData"],
  ["booking", "appointment"],
  ["Booking", "Appointment"],
  ["bookings", "appointments"],
  ["Bookings", "Appointments"],

  // Textos en español
  ["reserva", "cita"],
  ["Reserva", "Cita"],
  ["reservas", "citas"],
  ["Reservas", "Citas"],
];

// Aplicar reemplazos
replacements.forEach(([from, to]) => {
  content = content.replace(new RegExp(from, "g"), to);
});

// Escribir el archivo actualizado
fs.writeFileSync(filePath, content);

console.log(
  "✅ Archivo appointmentWidgetController.js actualizado exitosamente"
);
