// Script para actualizar clientPortalRoutes.js
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../src/routes/clientPortalRoutes.js");

// Leer el archivo
let content = fs.readFileSync(filePath, "utf8");

// Reemplazos sistemáticos
const replacements = [
  // URLs
  ["/api/bookings", "/api/appointments"],

  // Variables y parámetros
  ["booking_date", "appointment_date"],
  ["booking_time", "appointment_time"],
  ["booking_id", "appointment_id"],
  ["booking\\.", "appointment."],
  ["booking,", "appointment,"],
  ["booking\\)", "appointment)"],

  // Funciones RPC
  ["create_automatic_booking", "create_automatic_appointment"],
  ["p_booking_date", "p_appointment_date"],
  ["p_booking_time", "p_appointment_time"],

  // Textos y comentarios
  ["reserva", "cita"],
  ["Reserva", "Cita"],
  ["reservas", "citas"],
  ["Reservas", "Citas"],
  ["booking", "appointment"],
  ["Booking", "Appointment"],
  ["bookings", "appointments"],
  ["Bookings", "Appointments"],
];

// Aplicar reemplazos
replacements.forEach(([from, to]) => {
  content = content.replace(new RegExp(from, "g"), to);
});

// Escribir el archivo actualizado
fs.writeFileSync(filePath, content);

console.log("✅ Archivo clientPortalRoutes.js actualizado exitosamente");
