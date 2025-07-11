// src/controllers/bookingWidgetController.js
// Controlador para widget de reservas embebido en ricardoburitica.eu

const bookingWidgetService = require("../services/bookingWidgetService");
const logger = require("../utils/logger");

class BookingWidgetController {
  /**
   * Obtiene servicios disponibles para el widget
   */
  async getServices(req, res) {
    try {
      const services = await bookingWidgetService.getAvailableServices();

      res.json({
        success: true,
        data: services,
      });
    } catch (error) {
      logger.error("Error getting services for widget", {
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: "Failed to get services",
        message: error.message,
      });
    }
  }

  /**
   * Obtiene disponibilidad para un servicio
   */
  async getAvailability(req, res) {
    try {
      const { serviceId } = req.params;
      const { startDate, endDate } = req.query;

      // Validar parámetros
      if (!serviceId || !startDate) {
        return res.status(400).json({
          success: false,
          error: "Missing required parameters",
          required: ["serviceId", "startDate"],
        });
      }

      const availability = await bookingWidgetService.getServiceAvailability(
        serviceId,
        startDate,
        endDate,
      );

      res.json({
        success: true,
        data: availability,
      });
    } catch (error) {
      logger.error("Error getting availability for widget", {
        error: error.message,
        serviceId: req.params.serviceId,
      });

      res.status(500).json({
        success: false,
        error: "Failed to get availability",
        message: error.message,
      });
    }
  }

  /**
   * Crea una nueva reserva desde el widget
   */
  async createBooking(req, res) {
    try {
      const bookingData = req.body;

      // Validar datos básicos
      const { serviceId, datetime, clientInfo } = bookingData;

      if (!serviceId || !datetime || !clientInfo) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields",
          required: ["serviceId", "datetime", "clientInfo"],
        });
      }

      if (!clientInfo.name || !clientInfo.email) {
        return res.status(400).json({
          success: false,
          error: "Missing client information",
          required: ["clientInfo.name", "clientInfo.email"],
        });
      }

      // Crear reserva usando el servicio
      const result = await bookingWidgetService.createWebBooking(bookingData);

      logger.info("Booking created via widget", {
        bookingId: result.booking.id,
        service: result.booking.service,
        client: result.client.email,
      });

      res.status(201).json({
        success: true,
        message: "Booking created successfully",
        data: result,
      });
    } catch (error) {
      logger.error("Error creating booking via widget", {
        error: error.message,
        bookingData: req.body,
      });

      // Manejar errores específicos
      if (error.message.includes("no longer available")) {
        return res.status(409).json({
          success: false,
          error: "Time slot no longer available",
          message:
            "The selected time slot has been booked by another client. Please select a different time.",
        });
      }

      if (error.message.includes("Service not found")) {
        return res.status(404).json({
          success: false,
          error: "Service not found",
          message: "The selected service is not available.",
        });
      }

      res.status(500).json({
        success: false,
        error: "Failed to create booking",
        message:
          "An error occurred while processing your booking. Please try again.",
      });
    }
  }

  /**
   * Verifica disponibilidad de un slot específico
   */
  async checkSlotAvailability(req, res) {
    try {
      const { serviceId, datetime } = req.body;

      if (!serviceId || !datetime) {
        return res.status(400).json({
          success: false,
          error: "Missing required parameters",
          required: ["serviceId", "datetime"],
        });
      }

      const isAvailable = await bookingWidgetService.verifySlotAvailability(
        serviceId,
        datetime,
      );

      res.json({
        success: true,
        data: {
          available: isAvailable,
          datetime,
          serviceId,
        },
      });
    } catch (error) {
      logger.error("Error checking slot availability", {
        error: error.message,
        serviceId: req.body.serviceId,
        datetime: req.body.datetime,
      });

      res.status(500).json({
        success: false,
        error: "Failed to check availability",
        message: error.message,
      });
    }
  }

  /**
   * Obtiene configuración del widget
   */
  async getWidgetConfig(req, res) {
    try {
      const config = await bookingWidgetService.getWidgetConfig();

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      logger.error("Error getting widget config", { error: error.message });

      res.status(500).json({
        success: false,
        error: "Failed to get widget configuration",
        message: error.message,
      });
    }
  }

  /**
   * Obtiene reservas de un cliente
   */
  async getClientBookings(req, res) {
    try {
      const { email } = req.params;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: "Email is required",
        });
      }

      const result = await bookingWidgetService.getClientBookings(email);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error("Error getting client bookings", {
        error: error.message,
        email: req.params.email,
      });

      res.status(500).json({
        success: false,
        error: "Failed to get bookings",
        message: error.message,
      });
    }
  }

  /**
   * Cancela una reserva
   */
  async cancelBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const { email, reason } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: "Email is required for cancellation",
        });
      }

      const result = await bookingWidgetService.cancelBooking(
        bookingId,
        email,
        reason,
      );

      logger.info("Booking cancelled via widget", {
        bookingId,
        email,
        reason,
      });

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error("Error cancelling booking via widget", {
        error: error.message,
        bookingId: req.params.bookingId,
      });

      // Manejar errores específicos
      if (error.message.includes("not found")) {
        return res.status(404).json({
          success: false,
          error: "Booking not found",
        });
      }

      if (error.message.includes("Unauthorized")) {
        return res.status(403).json({
          success: false,
          error: "Unauthorized to cancel this booking",
        });
      }

      if (error.message.includes("cannot be cancelled")) {
        return res.status(400).json({
          success: false,
          error: "Booking cannot be cancelled",
          message:
            "Bookings can only be cancelled with at least 24 hours notice.",
        });
      }

      res.status(500).json({
        success: false,
        error: "Failed to cancel booking",
        message: error.message,
      });
    }
  }

  /**
   * Genera widget embebido para ricardoburitica.eu
   */
  async getEmbedWidget(req, res) {
    try {
      const { theme = "light", lang = "es" } = req.query;
      const baseUrl = `${req.protocol}://${req.get("host")}`;

      const widgetHTML = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reservar Cita - Ricardo Buriticá</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
        .booking-widget {
            max-width: 600px;
            margin: 0 auto;
            padding: 24px;
            border-radius: 16px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            background: ${theme === "dark" ? "#1f2937" : "#ffffff"};
            color: ${theme === "dark" ? "#f9fafb" : "#111827"};
        }
        .service-card {
            transition: all 0.3s ease;
            cursor: pointer;
        }
        .service-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.1);
        }
        .loading-spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #3B82F6;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div id="booking-widget" class="booking-widget">
        <div class="text-center mb-8">
            <h2 class="text-3xl font-bold mb-3 text-gray-800">Reservar Cita</h2>
            <p class="text-gray-600">Selecciona tu servicio y horario preferido</p>
            <div class="mt-4 flex items-center justify-center space-x-2">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    🤖 Asistente IA Activo
                </span>
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    📱 WhatsApp Integrado
                </span>
            </div>
        </div>
        
        <div id="widget-content">
            <div class="text-center py-12">
                <div class="loading-spinner"></div>
                <p class="mt-4 text-gray-500">Cargando servicios disponibles...</p>
            </div>
        </div>
    </div>

    <script>
        class BookingWidget {
            constructor() {
                this.apiBase = '${baseUrl}/api/widget';
                this.selectedService = null;
                this.selectedSlot = null;
                this.init();
            }

            async init() {
                try {
                    await this.loadServices();
                } catch (error) {
                    this.showError('Error al cargar los servicios disponibles');
                }
            }

            async loadServices() {
                const response = await fetch(\`\${this.apiBase}/services\`);
                const data = await response.json();
                
                if (data.success) {
                    this.renderServices(data.data);
                } else {
                    throw new Error(data.error);
                }
            }

            renderServices(services) {
                const content = document.getElementById('widget-content');
                content.innerHTML = \`
                    <div class="space-y-4">
                        <h3 class="text-xl font-semibold text-center mb-6">Selecciona un servicio:</h3>
                        <div class="grid gap-4">
                            \${services.map(service => \`
                                <div class="service-card border-2 border-gray-200 rounded-xl p-6 hover:border-blue-500"
                                     onclick="widget.selectService(\${service.id})">
                                    <div class="flex justify-between items-start">
                                        <div class="flex-1">
                                            <h4 class="font-semibold text-lg text-gray-800">\${service.name}</h4>
                                            <p class="text-gray-600 mt-1">\${service.description}</p>
                                            <div class="flex items-center mt-3 space-x-4">
                                                <span class="inline-flex items-center text-sm text-gray-500">
                                                    ⏱️ \${service.duration} min
                                                </span>
                                                <span class="inline-flex items-center text-sm text-gray-500">
                                                    📅 Disponible hoy
                                                </span>
                                            </div>
                                        </div>
                                        <div class="text-right ml-4">
                                            <p class="font-bold text-2xl text-blue-600">€\${service.price}</p>
                                            <button class="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                                Seleccionar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            \`).join('')}
                        </div>
                        
                        <div class="mt-8 p-4 bg-blue-50 rounded-lg">
                            <div class="flex items-center space-x-2">
                                <span class="text-blue-600">💬</span>
                                <p class="text-blue-800 font-medium">¿Prefieres reservar por WhatsApp?</p>
                            </div>
                            <p class="text-blue-700 mt-1">Envía un mensaje a nuestro asistente IA y te ayudará automáticamente.</p>
                            <a href="https://wa.me/34XXXXXXXXX?text=Hola, quiero reservar una cita" 
                               class="inline-block mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                                Abrir WhatsApp
                            </a>
                        </div>
                    </div>
                \`;
            }

            async selectService(serviceId) {
                this.selectedService = serviceId;
                
                try {
                    await this.loadAvailability(serviceId);
                } catch (error) {
                    this.showError('Error al cargar disponibilidad');
                }
            }

            async loadAvailability(serviceId) {
                const content = document.getElementById('widget-content');
                content.innerHTML = \`
                    <div class="text-center py-8">
                        <div class="loading-spinner"></div>
                        <p class="mt-4 text-gray-500">Cargando disponibilidad...</p>
                    </div>
                \`;

                const today = new Date().toISOString().split('T')[0];
                const response = await fetch(\`\${this.apiBase}/services/\${serviceId}/availability?startDate=\${today}\`);
                const data = await response.json();
                
                if (data.success) {
                    this.renderAvailability(data.data);
                } else {
                    throw new Error(data.error);
                }
            }

            renderAvailability(availabilityData) {
                const { service, availability } = availabilityData;
                
                // Agrupar slots por fecha
                const slotsByDate = {};
                availability.forEach(slot => {
                    if (!slotsByDate[slot.date]) {
                        slotsByDate[slot.date] = [];
                    }
                    slotsByDate[slot.date].push(slot);
                });

                const content = document.getElementById('widget-content');
                content.innerHTML = \`
                    <div>
                        <div class="flex items-center justify-between mb-6">
                            <h3 class="text-xl font-semibold">Disponibilidad - \${service.name}</h3>
                            <button onclick="widget.init()" class="text-blue-600 hover:text-blue-800">
                                ← Cambiar servicio
                            </button>
                        </div>
                        
                        \${Object.keys(slotsByDate).length === 0 ? \`
                            <div class="text-center py-8">
                                <p class="text-gray-500 mb-4">No hay disponibilidad en los próximos días</p>
                                <button onclick="widget.init()" class="px-4 py-2 bg-blue-600 text-white rounded-lg">
                                    Seleccionar otro servicio
                                </button>
                            </div>
                        \` : \`
                            <div class="space-y-6">
                                \${Object.entries(slotsByDate).map(([date, slots]) => \`
                                    <div>
                                        <h4 class="font-medium text-gray-800 mb-3">
                                            \${new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { 
                                                weekday: 'long', 
                                                year: 'numeric', 
                                                month: 'long', 
                                                day: 'numeric' 
                                            })}
                                        </h4>
                                        <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                            \${slots.map(slot => \`
                                                <button onclick="widget.selectSlot('\${slot.datetime}')" 
                                                        class="p-3 border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors">
                                                    \${slot.time}
                                                </button>
                                            \`).join('')}
                                        </div>
                                    </div>
                                \`).join('')}
                            </div>
                        \`}
                    </div>
                \`;
            }

            selectSlot(datetime) {
                this.selectedSlot = datetime;
                this.renderBookingForm();
            }

            renderBookingForm() {
                const content = document.getElementById('widget-content');
                const slotDate = new Date(this.selectedSlot);
                
                content.innerHTML = \`
                    <div>
                        <div class="flex items-center justify-between mb-6">
                            <h3 class="text-xl font-semibold">Completar Reserva</h3>
                            <button onclick="widget.selectService(\${this.selectedService})" class="text-blue-600 hover:text-blue-800">
                                ← Cambiar horario
                            </button>
                        </div>
                        
                        <div class="bg-blue-50 p-4 rounded-lg mb-6">
                            <h4 class="font-medium text-blue-800">Resumen de tu reserva:</h4>
                            <p class="text-blue-700 mt-1">
                                📅 \${slotDate.toLocaleDateString('es-ES')} a las \${slotDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                        
                        <form id="booking-form" class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                                <input type="text" id="client-name" required 
                                       class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                <input type="email" id="client-email" required 
                                       class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Teléfono (WhatsApp)</label>
                                <input type="tel" id="client-phone" 
                                       class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                       placeholder="+34 XXX XXX XXX">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Notas adicionales</label>
                                <textarea id="booking-notes" rows="3" 
                                          class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                          placeholder="Alguna preferencia o información adicional..."></textarea>
                            </div>
                            
                            <div class="bg-green-50 p-4 rounded-lg">
                                <div class="flex items-center space-x-2">
                                    <span class="text-green-600">✅</span>
                                    <p class="text-green-800 font-medium">Confirmación automática</p>
                                </div>
                                <p class="text-green-700 mt-1">Recibirás confirmación inmediata y recordatorios automáticos por WhatsApp.</p>
                            </div>
                            
                            <button type="submit" class="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
                                Confirmar Reserva
                            </button>
                        </form>
                    </div>
                \`;
                
                document.getElementById('booking-form').addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.submitBooking();
                });
            }

            async submitBooking() {
                const name = document.getElementById('client-name').value;
                const email = document.getElementById('client-email').value;
                const phone = document.getElementById('client-phone').value;
                const notes = document.getElementById('booking-notes').value;

                if (!name || !email) {
                    alert('Por favor completa todos los campos requeridos');
                    return;
                }

                try {
                    const response = await fetch(\`\${this.apiBase}/bookings\`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            serviceId: this.selectedService,
                            datetime: this.selectedSlot,
                            clientInfo: { name, email, phone },
                            notes,
                            source: 'web_widget_ricardoburitica'
                        })
                    });

                    const data = await response.json();
                    
                    if (data.success) {
                        this.showSuccess(data.data);
                    } else {
                        throw new Error(data.message || 'Error al crear la reserva');
                    }
                } catch (error) {
                    this.showError('Error al procesar la reserva: ' + error.message);
                }
            }

            showSuccess(bookingData) {
                const content = document.getElementById('widget-content');
                content.innerHTML = \`
                    <div class="text-center py-8">
                        <div class="text-6xl mb-4">🎉</div>
                        <h3 class="text-2xl font-bold text-green-600 mb-4">¡Reserva Confirmada!</h3>
                        
                        <div class="bg-green-50 p-6 rounded-lg mb-6">
                            <h4 class="font-semibold text-green-800 mb-2">Detalles de tu cita:</h4>
                            <div class="text-green-700 space-y-1">
                                <p>📅 Servicio: \${bookingData.booking.service}</p>
                                <p>🗓️ Fecha: \${bookingData.booking.date}</p>
                                <p>⏰ Hora: \${bookingData.booking.time}</p>
                                <p>💰 Precio: €\${bookingData.booking.price}</p>
                            </div>
                        </div>
                        
                        <div class="bg-blue-50 p-4 rounded-lg mb-6">
                            <p class="text-blue-800">
                                \${bookingData.client.phone ? 
                                    '📱 Te hemos enviado la confirmación por WhatsApp y recibirás recordatorios automáticos.' :
                                    '📧 Te hemos enviado la confirmación por email.'
                                }
                            </p>
                        </div>
                        
                        <button onclick="widget.init()" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                            Hacer otra reserva
                        </button>
                    </div>
                \`;
            }

            showError(message) {
                const content = document.getElementById('widget-content');
                content.innerHTML = \`
                    <div class="text-center py-8">
                        <div class="text-red-500 text-4xl mb-4">⚠️</div>
                        <h3 class="text-xl font-semibold text-red-600 mb-4">Error</h3>
                        <p class="text-red-600 mb-6">\${message}</p>
                        <button onclick="widget.init()" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                            Reintentar
                        </button>
                    </div>
                \`;
            }
        }

        // Inicializar widget
        const widget = new BookingWidget();
    </script>
</body>
</html>`;

      res.setHeader("Content-Type", "text/html");
      res.send(widgetHTML);
    } catch (error) {
      logger.error("Error generating embed widget", { error: error.message });
      res.status(500).send("<h1>Error loading booking widget</h1>");
    }
  }
}

module.exports = new BookingWidgetController();
