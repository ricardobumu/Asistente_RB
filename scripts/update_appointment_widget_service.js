// Script para actualizar appointmentWidgetService.js
const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "../src/services/appointmentWidgetService.js"
);

// Leer el archivo
let content = fs.readFileSync(filePath, "utf8");

// Reemplazos sistemáticos
const replacements = [
  // Comentarios de archivo
  ["bookingWidgetService.js", "appointmentWidgetService.js"],

  // Métodos
  ["createBooking", "createAppointment"],
  ["updateBooking", "updateAppointment"],
  ["deleteBooking", "deleteAppointment"],
  ["getBooking", "getAppointment"],
  ["getBookings", "getAppointments"],
  ["cancelBooking", "cancelAppointment"],
  ["confirmBooking", "confirmAppointment"],

  // Variables
  ["bookingData", "appointmentData"],
  ["bookingId", "appointmentId"],
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

console.log("✅ Archivo appointmentWidgetService.js actualizado exitosamente");
