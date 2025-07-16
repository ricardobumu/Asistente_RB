// Script para cambiar todas las referencias de booking a appointment
const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "../src/controllers/bookingController.js"
);

// Leer el archivo
let content = fs.readFileSync(filePath, "utf8");

// Reemplazos sistemáticos
const replacements = [
  // Variables y funciones
  ["bookingData", "appointmentData"],
  ["bookingService", "appointmentService"],
  ["bookingId", "appointmentId"],
  ["bookingResult", "appointmentResult"],
  ["currentBooking", "currentAppointment"],

  // Métodos
  ["createBooking", "createAppointment"],
  ["getBookings", "getAppointments"],
  ["getBookingById", "getAppointmentById"],
  ["updateBooking", "updateAppointment"],
  ["cancelBooking", "cancelAppointment"],
  ["confirmBooking", "confirmAppointment"],
  ["rescheduleBooking", "rescheduleAppointment"],

  // Textos y comentarios
  ["reserva", "cita"],
  ["Reserva", "Cita"],
  ["reservas", "citas"],
  ["Reservas", "Citas"],
  ["booking", "appointment"],
  ["Booking", "Appointment"],
  ["bookings", "appointments"],
  ["Bookings", "Appointments"],

  // URLs
  ["/api/bookings", "/api/appointments"],

  // Notificaciones
  ["sendBookingCancellation", "sendAppointmentCancellation"],
  ["sendBookingConfirmation", "sendAppointmentConfirmation"],
  ["sendBookingReminder", "sendAppointmentReminder"],
];

// Aplicar reemplazos
replacements.forEach(([from, to]) => {
  content = content.replace(new RegExp(from, "g"), to);
});

// Escribir el archivo actualizado
fs.writeFileSync(filePath, content);

console.log("✅ Archivo bookingController.js actualizado exitosamente");
