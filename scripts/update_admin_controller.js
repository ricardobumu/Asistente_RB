// Script para actualizar adminAppointmentController.js
const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "../src/controllers/adminAppointmentController.js"
);

// Leer el archivo
let content = fs.readFileSync(filePath, "utf8");

// Reemplazos sistemáticos
const replacements = [
  // Servicios
  ["AdminBookingService", "AdminAppointmentService"],
  ["BookingService", "AppointmentService"],

  // Métodos y variables
  ["booking", "appointment"],
  ["Booking", "Appointment"],
  ["bookings", "appointments"],
  ["Bookings", "Appointments"],

  // Textos en español
  ["reserva", "cita"],
  ["Reserva", "Cita"],
  ["reservas", "citas"],
  ["Reservas", "Citas"],

  // Exportar clase
  [
    "module.exports = AdminBookingController;",
    "module.exports = AdminAppointmentController;",
  ],
];

// Aplicar reemplazos
replacements.forEach(([from, to]) => {
  content = content.replace(new RegExp(from, "g"), to);
});

// Escribir el archivo actualizado
fs.writeFileSync(filePath, content);

console.log(
  "✅ Archivo adminAppointmentController.js actualizado exitosamente"
);
