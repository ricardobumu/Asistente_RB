// src/routes/clientPortalRoutes.js
// Rutas para el Portal del Cliente

const express = require("express");
const path = require("path");
const router = express.Router();
const BookingService = require("../services/bookingService");
const ServiceService = require("../services/serviceService");
const ClientService = require("../services/clientService");
const { supabaseClient } = require("../integrations/supabaseClient");
const logger = require("../utils/logger");
const { body, param, query, validationResult } = require("express-validator");

// =====================================================
// MIDDLEWARE DE VALIDACIÓN
// =====================================================

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: "Datos de entrada inválidos",
      details: errors.array(),
    });
  }
  next();
};

// =====================================================
// RUTAS ESTÁTICAS - PORTAL CLIENTE
// =====================================================

// Página principal del portal cliente
router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../../public/client/index.html"));
});

// Archivos estáticos del cliente
router.get("/client.js", (req, res) => {
  res.sendFile(path.join(__dirname, "../../public/client/client.js"));
});

// =====================================================
// API - SERVICIOS
// =====================================================

// Obtener todos los servicios activos
router.get("/api/services", async (req, res) => {
  try {
    logger.info("Client portal: Getting services");

    const result = await ServiceService.getActiveServices();

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error("Error getting services for client portal", {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

// Obtener detalles de un servicio específico
router.get(
  "/api/services/:id",
  param("id").isUUID().withMessage("ID de servicio inválido"),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;

      const { data: service, error } = await supabaseClient
        .from("services")
        .select("*")
        .eq("id", id)
        .eq("active", true)
        .single();

      if (error) throw error;

      if (!service) {
        return res.status(404).json({
          success: false,
          error: "Servicio no encontrado",
        });
      }

      res.json({
        success: true,
        data: service,
      });
    } catch (error) {
      logger.error("Error getting service details", {
        error: error.message,
        serviceId: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: "Error al obtener detalles del servicio",
      });
    }
  }
);

// =====================================================
// API - DISPONIBILIDAD
// =====================================================

// Obtener disponibilidad para un servicio
router.get(
  "/api/availability/:serviceId",
  param("serviceId").isUUID().withMessage("ID de servicio inválido"),
  query("date").isISO8601().withMessage("Fecha inválida"),
  query("days")
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage("Días debe ser entre 1 y 30"),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { serviceId } = req.params;
      const { date, days = 7 } = req.query;

      logger.info("Client portal: Getting availability", {
        serviceId,
        date,
        days,
      });

      // Usar función de Supabase si está disponible
      try {
        const { data: availability, error } = await supabaseClient.rpc(
          "get_available_slots",
          {
            p_service_id: serviceId,
            p_date: date,
            p_days_ahead: parseInt(days),
          }
        );

        if (error) throw error;

        res.json({
          success: true,
          data: availability,
        });
      } catch (rpcError) {
        // Fallback: método tradicional
        logger.warn("RPC function not available, using fallback", {
          error: rpcError.message,
        });

        const slots = await generateAvailableSlots(
          serviceId,
          date,
          parseInt(days)
        );
        res.json({
          success: true,
          data: {
            service_id: serviceId,
            search_from: date,
            days_searched: parseInt(days),
            available_slots: slots,
          },
        });
      }
    } catch (error) {
      logger.error("Error getting availability", {
        error: error.message,
        serviceId: req.params.serviceId,
        date: req.query.date,
      });
      res.status(500).json({
        success: false,
        error: "Error al obtener disponibilidad",
      });
    }
  }
);

// =====================================================
// API - RESERVAS
// =====================================================

// Crear nueva reserva
router.post(
  "/api/bookings",
  [
    body("service_id").isUUID().withMessage("ID de servicio inválido"),
    body("booking_date").isISO8601().withMessage("Fecha de reserva inválida"),
    body("booking_time")
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Hora inválida (formato HH:MM)"),
    body("client_name")
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Nombre debe tener entre 2 y 100 caracteres"),
    body("client_phone")
      .trim()
      .isLength({ min: 9, max: 20 })
      .withMessage("Teléfono inválido"),
    body("client_email").optional().isEmail().withMessage("Email inválido"),
    body("notes")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Notas demasiado largas"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const {
        service_id,
        booking_date,
        booking_time,
        client_name,
        client_phone,
        client_email,
        notes,
      } = req.body;

      logger.info("Client portal: Creating booking", {
        service_id,
        booking_date,
        booking_time,
        client_phone: client_phone.substring(0, 3) + "***", // Log parcial por seguridad
      });

      // Usar función de Supabase si está disponible
      try {
        const { data: booking, error } = await supabaseClient.rpc(
          "create_automatic_booking",
          {
            p_client_phone: client_phone,
            p_client_name: client_name,
            p_client_email: client_email,
            p_service_id: service_id,
            p_booking_date: booking_date,
            p_booking_time: booking_time,
            p_notes: notes,
          }
        );

        if (error) throw error;

        if (!booking.success) {
          return res.status(400).json({
            success: false,
            error: booking.error || "No se pudo crear la reserva",
          });
        }

        logger.info("Booking created successfully via RPC", {
          booking_id: booking.booking_id,
        });

        res.json({
          success: true,
          data: booking,
        });
      } catch (rpcError) {
        // Fallback: método tradicional
        logger.warn(
          "RPC function not available, using fallback booking creation",
          { error: rpcError.message }
        );

        const result = await BookingService.createBooking({
          service_id,
          booking_date,
          booking_time,
          client_name,
          client_phone,
          client_email,
          notes,
          created_via: "client_portal",
        });

        if (result.success) {
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      }
    } catch (error) {
      logger.error("Error creating booking from client portal", {
        error: error.message,
        body: {
          ...req.body,
          client_phone: req.body.client_phone?.substring(0, 3) + "***",
        },
      });
      res.status(500).json({
        success: false,
        error: "Error interno al crear la reserva",
      });
    }
  }
);

// Obtener reservas de un cliente por teléfono
router.get(
  "/api/bookings/client/:phone",
  param("phone")
    .trim()
    .isLength({ min: 9, max: 20 })
    .withMessage("Teléfono inválido"),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { phone } = req.params;

      logger.info("Client portal: Getting client bookings", {
        phone: phone.substring(0, 3) + "***",
      });

      // Buscar cliente por teléfono
      const { data: client, error: clientError } = await supabaseClient
        .from("clients")
        .select("id")
        .eq("phone", phone)
        .single();

      if (clientError || !client) {
        return res.json({
          success: true,
          data: [],
        });
      }

      // Obtener reservas del cliente
      const { data: bookings, error: bookingsError } = await supabaseClient
        .from("bookings")
        .select(
          `
          id,
          booking_date,
          booking_time,
          duration,
          status,
          notes,
          created_at,
          services (
            name,
            price
          )
        `
        )
        .eq("client_id", client.id)
        .order("booking_date", { ascending: false });

      if (bookingsError) throw bookingsError;

      // Formatear respuesta
      const formattedBookings = bookings.map((booking) => ({
        id: booking.id,
        service_name: booking.services.name,
        price: booking.services.price,
        booking_date: booking.booking_date,
        booking_time: booking.booking_time,
        duration: booking.duration,
        status: booking.status,
        notes: booking.notes,
        created_at: booking.created_at,
      }));

      res.json({
        success: true,
        data: formattedBookings,
      });
    } catch (error) {
      logger.error("Error getting client bookings", {
        error: error.message,
        phone: req.params.phone?.substring(0, 3) + "***",
      });
      res.status(500).json({
        success: false,
        error: "Error al obtener las reservas",
      });
    }
  }
);

// Cancelar reserva
router.put(
  "/api/bookings/:id/cancel",
  param("id").isUUID().withMessage("ID de reserva inválido"),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;

      logger.info("Client portal: Cancelling booking", { booking_id: id });

      // Verificar que la reserva existe y se puede cancelar
      const { data: booking, error: fetchError } = await supabaseClient
        .from("bookings")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !booking) {
        return res.status(404).json({
          success: false,
          error: "Reserva no encontrada",
        });
      }

      // Verificar que la reserva se puede cancelar (no está en el pasado)
      const bookingDateTime = new Date(
        `${booking.booking_date}T${booking.booking_time}`
      );
      const now = new Date();

      if (bookingDateTime < now) {
        return res.status(400).json({
          success: false,
          error: "No se puede cancelar una reserva pasada",
        });
      }

      if (booking.status === "cancelled") {
        return res.status(400).json({
          success: false,
          error: "La reserva ya está cancelada",
        });
      }

      // Cancelar reserva
      const { error: updateError } = await supabaseClient
        .from("bookings")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) throw updateError;

      logger.info("Booking cancelled successfully", { booking_id: id });

      res.json({
        success: true,
        message: "Reserva cancelada correctamente",
      });
    } catch (error) {
      logger.error("Error cancelling booking", {
        error: error.message,
        booking_id: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: "Error al cancelar la reserva",
      });
    }
  }
);

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

async function generateAvailableSlots(serviceId, startDate, days) {
  try {
    // Obtener información del servicio
    const { data: service, error: serviceError } = await supabaseClient
      .from("services")
      .select("duration_minutes")
      .eq("id", serviceId)
      .single();

    if (serviceError) throw serviceError;

    const slots = [];
    const start = new Date(startDate);

    for (let i = 0; i < days; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);

      // Solo días laborables (lunes a viernes)
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Horarios de 9:00 a 18:00 cada 30 minutos
        for (let hour = 9; hour < 18; hour++) {
          for (let minute = 0; minute < 60; minute += 30) {
            const timeString = `${hour.toString().padStart(2, "0")}:${minute
              .toString()
              .padStart(2, "0")}`;

            // Verificar disponibilidad
            const isAvailable = await checkSlotAvailability(
              serviceId,
              currentDate.toISOString().split("T")[0],
              timeString,
              service.duration_minutes
            );

            if (isAvailable) {
              slots.push({
                date: currentDate.toISOString().split("T")[0],
                time: timeString,
                datetime: `${
                  currentDate.toISOString().split("T")[0]
                }T${timeString}`,
                duration: service.duration_minutes,
              });
            }
          }
        }
      }
    }

    return slots;
  } catch (error) {
    logger.error("Error generating available slots", { error: error.message });
    return [];
  }
}

async function checkSlotAvailability(serviceId, date, time, duration) {
  try {
    const endTime = addMinutesToTime(time, duration);

    const { data: conflicts, error } = await supabaseClient
      .from("bookings")
      .select("id")
      .eq("service_id", serviceId)
      .eq("booking_date", date)
      .in("status", ["confirmed", "pending"])
      .or(
        `and(booking_time.lte.${time},booking_time.gte.${endTime}),and(booking_time.lt.${endTime},booking_time.gte.${time})`
      );

    if (error) throw error;

    return !conflicts || conflicts.length === 0;
  } catch (error) {
    logger.error("Error checking slot availability", { error: error.message });
    return false;
  }
}

function addMinutesToTime(time, minutes) {
  const [hours, mins] = time.split(":").map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60);
  const newMins = totalMinutes % 60;
  return `${newHours.toString().padStart(2, "0")}:${newMins
    .toString()
    .padStart(2, "0")}`;
}

module.exports = router;
