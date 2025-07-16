// Script para actualizar servicios de booking a appointment
const fs = require("fs");
const path = require("path");

const files = [
  "../src/services/appointmentService.js",
  "../src/services/adminAppointmentService.js",
];

// Reemplazos sistemáticos
const replacements = [
  // Comentarios de archivo
  ["bookingService.js", "appointmentService.js"],
  ["adminBookingService.js", "adminAppointmentService.js"],

  // Clases
  ["BookingService", "AppointmentService"],
  ["AdminBookingService", "AdminAppointmentService"],

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

  // Tablas de base de datos (mantener como appointments)
  ["tabla appointments", "tabla appointments"],

  // URLs
  ["/api/bookings", "/api/appointments"],
];

files.forEach((file) => {
  const filePath = path.join(__dirname, file);

  if (fs.existsSync(filePath)) {
    console.log(`📝 Actualizando ${file}...`);

    // Leer el archivo
    let content = fs.readFileSync(filePath, "utf8");

    // Aplicar reemplazos
    replacements.forEach(([from, to]) => {
      content = content.replace(new RegExp(from, "g"), to);
    });

    // Escribir el archivo actualizado
    fs.writeFileSync(filePath, content);

    console.log(`✅ ${file} actualizado exitosamente`);
  } else {
    console.log(`⚠️ Archivo ${file} no encontrado`);
  }
});

console.log("🎯 Actualización de servicios completada");
