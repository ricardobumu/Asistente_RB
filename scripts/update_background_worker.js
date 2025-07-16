// Script para actualizar backgroundWorker.js
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../src/workers/backgroundWorker.js");

// Leer el archivo
let content = fs.readFileSync(filePath, "utf8");

// Reemplazos sistemáticos
const replacements = [
  // Handlers y métodos
  ["process_booking", "process_appointment"],
  ["handleProcessBooking", "handleProcessAppointment"],
  ["confirmBooking", "confirmAppointment"],
  ["cancelBooking", "cancelAppointment"],
  ["sendBookingReminder", "sendAppointmentReminder"],
  ["getBookingDetails", "getAppointmentDetails"],

  // Variables
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

  // Parámetros
  ["timeBeforeBooking", "timeBeforeAppointment"],
];

// Aplicar reemplazos
replacements.forEach(([from, to]) => {
  content = content.replace(new RegExp(from, "g"), to);
});

// Escribir el archivo actualizado
fs.writeFileSync(filePath, content);

console.log("✅ Archivo backgroundWorker.js actualizado exitosamente");
