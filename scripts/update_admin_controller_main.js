// Script para actualizar adminController.js
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../src/controllers/adminController.js");

// Leer el archivo
let content = fs.readFileSync(filePath, "utf8");

// Reemplazos sistemáticos - solo para variables y métodos, no para nombres de tablas
const replacements = [
  // Métodos
  ["getBookingStats", "getAppointmentStats"],

  // Variables (pero mantenemos "bookings" como nombre de tabla)
  ["const bookings,", "const appointments,"],
  ["bookings:", "appointments:"],
  ["bookings ||", "appointments ||"],
  ["bookings?.", "appointments?."],
  ["recentBookings", "recentAppointments"],
  ["todayBookings", "todayAppointments"],

  // Textos en español
  ["reserva", "cita"],
  ["Reserva", "Cita"],
  ["reservas", "citas"],
  ["Reservas", "Citas"],

  // Comentarios y mensajes de error
  ["Failed to get bookings", "Failed to get appointments"],
  ["Error getting bookings", "Error getting appointments"],
];

// Aplicar reemplazos
replacements.forEach(([from, to]) => {
  content = content.replace(new RegExp(from, "g"), to);
});

// Escribir el archivo actualizado
fs.writeFileSync(filePath, content);

console.log("✅ Archivo adminController.js actualizado exitosamente");
