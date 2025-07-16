// Script para actualizar appointmentWidgetRoutes.js
const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "../src/routes/appointmentWidgetRoutes.js"
);

// Leer el archivo
let content = fs.readFileSync(filePath, "utf8");

// Reemplazos sistemáticos
const replacements = [
  // Comentarios de archivo
  ["bookingWidgetRoutes.js", "appointmentWidgetRoutes.js"],

  // Servicios y controladores
  ["BookingService", "AppointmentService"],
  ["bookingController", "appointmentController"],

  // Variables y métodos
  ["booking", "appointment"],
  ["Booking", "Appointment"],
  ["bookings", "appointments"],
  ["Bookings", "Appointments"],

  // Textos en español
  ["reserva", "cita"],
  ["Reserva", "Cita"],
  ["reservas", "citas"],
  ["Reservas", "Citas"],

  // URLs y rutas
  ["/booking", "/appointment"],
  ["/bookings", "/appointments"],
];

// Aplicar reemplazos
replacements.forEach(([from, to]) => {
  content = content.replace(new RegExp(from, "g"), to);
});

// Escribir el archivo actualizado
fs.writeFileSync(filePath, content);

console.log("✅ Archivo appointmentWidgetRoutes.js actualizado exitosamente");
