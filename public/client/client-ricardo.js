// public/client/client-ricardo.js
// Portal del Cliente - Ricardo Buriticá con servicios reales

class RicardoClientPortal {
  constructor() {
    this.currentStep = 1;
    this.maxSteps = 4;
    this.selectedService = null;
    this.selectedSlot = null;
    this.bookingData = {};
    this.services = []; // Se cargarán desde la base de datos

    this.init();
  }

  init() {
    this.setupNavigation();
    this.setupBookingForm();
    this.loadRicardoServices();
    this.setupEventListeners();
    this.setupCategoryFilters();
  }

  setupNavigation() {
    const navButtons = document.querySelectorAll(".nav-btn");
    const sections = document.querySelectorAll(".section");

    navButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetSection = btn.dataset.section;

        // Update nav buttons
        navButtons.forEach((b) => {
          b.classList.remove(
            "active",
            "border-ricardo-gold",
            "text-ricardo-gold",
          );
          b.classList.add("border-transparent", "text-gray-600");
        });
        btn.classList.add("active", "border-ricardo-gold", "text-ricardo-gold");
        btn.classList.remove("border-transparent", "text-gray-600");

        // Update sections
        sections.forEach((section) => {
          section.classList.add("hidden");
          section.classList.remove("active");
        });

        const targetEl = document.getElementById(`${targetSection}-section`);
        if (targetEl) {
          targetEl.classList.remove("hidden");
          targetEl.classList.add("active");
        }
      });
    });
  }

  setupCategoryFilters() {
    const filterButtons = document.querySelectorAll(".category-filter");

    filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const category = btn.dataset.category;

        // Update active filter
        filterButtons.forEach((b) => {
          b.classList.remove("active");
          b.style.background = "rgba(141, 124, 105, 0.1)";
          b.style.color = "#6b5a4a";
        });

        btn.classList.add("active");
        btn.style.background = "#8d7c69";
        btn.style.color = "white";

        // Filter services
        this.filterServices(category);
      });
    });
  }

  filterServices(category) {
    const serviceCards = document.querySelectorAll(".service-card");

    serviceCards.forEach((card) => {
      const serviceCategory = card.dataset.category;

      if (category === "all" || serviceCategory === category) {
        card.style.display = "block";
        setTimeout(() => {
          card.style.opacity = "1";
          card.style.transform = "scale(1)";
        }, 50);
      } else {
        card.style.opacity = "0";
        card.style.transform = "scale(0.8)";
        setTimeout(() => {
          card.style.display = "none";
        }, 300);
      }
    });
  }

  async loadRicardoServices() {
    try {
      // Simular carga desde API - en producción sería: /client/api/servicios
      const response = await this.fetchRicardoServices();

      if (response.success) {
        this.services = response.data;
        this.renderRicardoServices(this.services);
        this.renderServiceSelection(this.services);
      } else {
        console.error("Error loading Ricardo services:", response.error);
        this.showErrorMessage("Error al cargar los servicios");
      }
    } catch (error) {
      console.error("Error loading services:", error);
      this.showErrorMessage("Error de conexión al cargar servicios");
    }
  }

  async fetchRicardoServices() {
    // En desarrollo, usar datos simulados basados en tus servicios reales
    return {
      success: true,
      data: [
        {
          id_servicio: "c930e9c1-95f5-4c0c-a232-a9260a969b4e",
          nombre: "Asesoría de Belleza - Primera Visita",
          descripcion:
            "Primera visita - Asesoría de Belleza. Tu primera visita es mucho más que un simple encuentro: es el inicio de un viaje hacia tu mejor versión.",
          precio: 30,
          duracion: 60,
          categoria: "ASESORÍA",
          activo: true,
        },
        {
          id_servicio: "23e70147-7383-45cc-a055-7042e38a5d5d",
          nombre: "Coloración Raíz + Baño + Cortar",
          descripcion:
            "Paquete completo de coloración y cuidado capilar con corte personalizado.",
          precio: 105,
          duracion: 150,
          categoria: "COLORACIÓN",
          activo: true,
        },
        {
          id_servicio: "b9a7e3d1-55c2-4f1a-92ef-123456789abc",
          nombre: "Corte Mujer",
          descripcion:
            "Corte diseñado para adaptarse a cada tipo de rostro y estilo. Lavado+Tratamiento básico y secado incluido.",
          precio: 71,
          duracion: 120,
          categoria: "CORTE",
          activo: true,
        },
        {
          id_servicio: "8baa7eb4-2795-4c7e-85f7-8ef21b3f9f07",
          nombre: "Corte Hombre",
          descripcion: "Cortes masculinos adaptados a tu estilo personal.",
          precio: 30,
          duracion: 60,
          categoria: "CORTE",
          activo: true,
        },
        {
          id_servicio: "d3f8b2a1-77c4-4e9d-a1f1-789012345678",
          nombre: "Enzimoterapia - Alisado Progresivo",
          descripcion: "Alisado progresivo con duración de 7 meses.",
          precio: 300,
          duracion: 180,
          categoria: "TRATAMIENTO",
          activo: true,
        },
        {
          id_servicio: "eddce199-8c88-437b-8789-f732de565908",
          nombre: "Hidratación Capilar",
          descripcion:
            "Tratamiento completo de hidratación con tecnología avanzada.",
          precio: 66,
          duracion: 90,
          categoria: "TRATAMIENTO",
          activo: true,
        },
      ],
    };
  }

  renderRicardoServices(services) {
    const grid = document.getElementById("services-grid");
    grid.innerHTML = "";

    services.forEach((service) => {
      const card = document.createElement("div");
      card.className =
        "service-card bg-white rounded-2xl luxury-shadow p-8 relative overflow-hidden";
      card.dataset.category = service.categoria;
      card.style.opacity = "1";
      card.style.transform = "scale(1)";
      card.style.transition = "all 0.3s ease";

      card.innerHTML = `
                <div class="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-ricardo-gold to-ricardo-gold-light opacity-10 rounded-bl-full"></div>
                <div class="relative z-10">
                    <div class="flex justify-between items-start mb-4">
                        <span class="category-badge px-3 py-1 rounded-full text-xs font-semibold">
                            ${service.categoria}
                        </span>
                        <div class="text-right">
                            <div class="text-2xl font-bold text-ricardo-gold">€${service.precio}</div>
                            <div class="text-sm text-gray-500">${service.duracion} min</div>
                        </div>
                    </div>
                    
                    <h3 class="font-serif text-xl font-semibold mb-3 text-ricardo-dark leading-tight">
                        ${service.nombre}
                    </h3>
                    
                    <p class="text-gray-600 mb-6 leading-relaxed line-clamp-3">
                        ${service.descripcion}
                    </p>
                    
                    <div class="flex items-center justify-between">
                        <div class="flex items-center text-sm text-gray-500">
                            <i class="fas fa-clock mr-2 text-ricardo-gold"></i>
                            ${service.duracion} minutos
                        </div>
                        <button class="book-service-btn px-6 py-3 btn-gold text-white rounded-xl font-medium" data-service-id="${service.id_servicio}">
                            Reservar
                        </button>
                    </div>
                </div>
            `;

      // Add click handler for booking
      card.querySelector(".book-service-btn").addEventListener("click", () => {
        this.selectServiceAndGoToBooking(service);
      });

      grid.appendChild(card);
    });
  }

  renderServiceSelection(services) {
    const container = document.getElementById("service-selection");
    container.innerHTML = "";

    services.forEach((service) => {
      const option = document.createElement("div");
      option.className =
        "service-option p-6 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-ricardo-gold hover:bg-ricardo-cream transition-all duration-300";
      option.dataset.serviceId = service.id_servicio;

      option.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <div class="flex items-center mb-2">
                            <span class="category-badge px-2 py-1 rounded text-xs font-semibold mr-3">
                                ${service.categoria}
                            </span>
                        </div>
                        <h4 class="font-serif font-semibold text-ricardo-dark mb-1">${service.nombre}</h4>
                        <p class="text-sm text-gray-600">${service.duracion} minutos</p>
                    </div>
                    <div class="text-right ml-4">
                        <span class="text-2xl font-bold text-ricardo-gold">€${service.precio}</span>
                    </div>
                </div>
            `;

      option.addEventListener("click", () => {
        // Remove selection from others
        container.querySelectorAll(".service-option").forEach((opt) => {
          opt.classList.remove("border-ricardo-gold", "bg-ricardo-cream");
          opt.classList.add("border-gray-200");
        });

        // Select this one
        option.classList.add("border-ricardo-gold", "bg-ricardo-cream");
        option.classList.remove("border-gray-200");

        this.selectedService = service;
        this.updateStepIndicator(1);
      });

      container.appendChild(option);
    });
  }

  selectServiceAndGoToBooking(service) {
    this.selectedService = service;

    // Switch to booking section
    document.querySelector('[data-section="booking"]').click();

    // Pre-select the service
    setTimeout(() => {
      const serviceOption = document.querySelector(
        `[data-service-id="${service.id_servicio}"]`,
      );
      if (serviceOption) {
        serviceOption.click();
      }
    }, 100);
  }

  setupBookingForm() {
    const nextBtn = document.getElementById("next-step");
    const prevBtn = document.getElementById("prev-step");
    const confirmBtn = document.getElementById("confirm-booking");

    nextBtn.addEventListener("click", () => this.nextStep());
    prevBtn.addEventListener("click", () => this.prevStep());
    confirmBtn.addEventListener("click", (e) => {
      e.preventDefault();
      this.confirmBooking();
    });

    // Date change handler
    document.getElementById("booking-date").addEventListener("change", (e) => {
      if (this.selectedService && e.target.value) {
        this.loadAvailableSlots(
          this.selectedService.id_servicio,
          e.target.value,
        );
      }
    });

    // Set minimum date to today
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("booking-date").min = today;
  }

  setupEventListeners() {
    // Lookup bookings
    document.getElementById("lookup-bookings").addEventListener("click", () => {
      const phone = document.getElementById("lookup-phone").value;
      if (phone) {
        this.lookupBookings(phone);
      }
    });

    // Contact form
    document.getElementById("contact-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.submitContactForm(e.target);
    });

    // Modal close handlers
    document.getElementById("close-success").addEventListener("click", () => {
      document.getElementById("success-modal").classList.add("hidden");
    });
  }

  nextStep() {
    if (!this.validateCurrentStep()) {
      return;
    }

    if (this.currentStep < this.maxSteps) {
      this.currentStep++;
      this.updateStepDisplay();
      this.updateStepIndicator(this.currentStep);

      if (this.currentStep === 4) {
        this.showBookingSummary();
      }
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateStepDisplay();
      this.updateStepIndicator(this.currentStep);
    }
  }

  validateCurrentStep() {
    switch (this.currentStep) {
      case 1:
        if (!this.selectedService) {
          this.showAlert("Por favor selecciona un servicio", "warning");
          return false;
        }
        break;
      case 2:
        const date = document.getElementById("booking-date").value;
        if (!date || !this.selectedSlot) {
          this.showAlert("Por favor selecciona fecha y hora", "warning");
          return false;
        }
        break;
      case 3:
        const name = document.getElementById("client-name").value;
        const phone = document.getElementById("client-phone").value;
        if (!name || !phone) {
          this.showAlert(
            "Por favor completa los campos obligatorios",
            "warning",
          );
          return false;
        }
        break;
    }
    return true;
  }

  updateStepDisplay() {
    // Hide all steps
    document.querySelectorAll(".booking-step").forEach((step) => {
      step.classList.add("hidden");
    });

    // Show current step
    document
      .getElementById(`step-${this.getStepName()}`)
      .classList.remove("hidden");

    // Update buttons
    const prevBtn = document.getElementById("prev-step");
    const nextBtn = document.getElementById("next-step");
    const confirmBtn = document.getElementById("confirm-booking");

    prevBtn.classList.toggle("hidden", this.currentStep === 1);
    nextBtn.classList.toggle("hidden", this.currentStep === this.maxSteps);
    confirmBtn.classList.toggle("hidden", this.currentStep !== this.maxSteps);
  }

  updateStepIndicator(step) {
    const indicators = document.querySelectorAll(".step-indicator");
    const lines = document.querySelectorAll(".step-line");

    indicators.forEach((indicator, index) => {
      if (index < step) {
        indicator.classList.add("bg-ricardo-gold", "text-white");
        indicator.classList.remove("bg-gray-200", "text-gray-500");
      } else {
        indicator.classList.remove("bg-ricardo-gold", "text-white");
        indicator.classList.add("bg-gray-200", "text-gray-500");
      }
    });

    lines.forEach((line, index) => {
      if (index < step - 1) {
        line.classList.add("bg-ricardo-gold");
        line.classList.remove("bg-gray-200");
      } else {
        line.classList.remove("bg-ricardo-gold");
        line.classList.add("bg-gray-200");
      }
    });
  }

  getStepName() {
    const steps = ["service", "datetime", "info", "confirm"];
    return steps[this.currentStep - 1];
  }

  async loadAvailableSlots(serviceId, date) {
    try {
      this.showLoading();

      // Simular carga de slots disponibles
      const slots = this.generateMockSlots(date);

      this.hideLoading();
      this.renderAvailableSlots(slots);
    } catch (error) {
      this.hideLoading();
      console.error("Error loading slots:", error);
      this.renderAvailableSlots([]);
    }
  }

  generateMockSlots(date) {
    const slots = [];
    const selectedDate = new Date(date);
    const dayOfWeek = selectedDate.getDay();

    // Solo días laborables (lunes a viernes)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // Horarios de 9:00 a 18:00 cada 30 minutos
      for (let hour = 9; hour < 18; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const timeString = `${hour.toString().padStart(2, "0")}:${minute
            .toString()
            .padStart(2, "0")}`;
          slots.push({
            time: timeString,
            available: Math.random() > 0.3, // 70% de probabilidad de estar disponible
          });
        }
      }
    }

    return slots.filter((slot) => slot.available);
  }

  renderAvailableSlots(slots) {
    const container = document.getElementById("available-slots");
    container.innerHTML = "";

    if (slots.length === 0) {
      container.innerHTML = `
                <div class="col-span-3 text-center py-8">
                    <i class="fas fa-calendar-times text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-500">No hay horarios disponibles para esta fecha</p>
                    <p class="text-sm text-gray-400 mt-2">Prueba con otra fecha</p>
                </div>
            `;
      return;
    }

    slots.forEach((slot) => {
      const slotBtn = document.createElement("button");
      slotBtn.type = "button";
      slotBtn.className =
        "booking-slot p-3 text-sm border-2 border-gray-200 rounded-lg hover:border-ricardo-gold transition-all duration-300";
      slotBtn.textContent = slot.time;
      slotBtn.dataset.slot = JSON.stringify(slot);

      slotBtn.addEventListener("click", () => {
        // Remove selection from others
        container.querySelectorAll(".booking-slot").forEach((btn) => {
          btn.classList.remove(
            "selected",
            "bg-ricardo-gold",
            "text-white",
            "border-ricardo-gold-dark",
          );
          btn.classList.add("border-gray-200");
        });

        // Select this one
        slotBtn.classList.add(
          "selected",
          "bg-ricardo-gold",
          "text-white",
          "border-ricardo-gold-dark",
        );
        slotBtn.classList.remove("border-gray-200");

        this.selectedSlot = slot;
      });

      container.appendChild(slotBtn);
    });
  }

  showBookingSummary() {
    const summary = document.getElementById("booking-summary");
    const date = document.getElementById("booking-date").value;
    const name = document.getElementById("client-name").value;
    const phone = document.getElementById("client-phone").value;
    const email = document.getElementById("client-email").value;
    const notes = document.getElementById("booking-notes").value;

    summary.innerHTML = `
            <div class="text-center mb-8">
                <i class="fas fa-calendar-check text-4xl text-ricardo-gold mb-4"></i>
                <h4 class="font-serif text-2xl font-semibold text-ricardo-dark">Resumen de tu Reserva</h4>
            </div>
            
            <div class="grid md:grid-cols-2 gap-8">
                <div class="space-y-4">
                    <div class="flex justify-between items-center py-3 border-b border-gray-200">
                        <span class="font-medium text-ricardo-dark">Servicio:</span>
                        <span class="text-right">${
                          this.selectedService.nombre
                        }</span>
                    </div>
                    <div class="flex justify-between items-center py-3 border-b border-gray-200">
                        <span class="font-medium text-ricardo-dark">Fecha:</span>
                        <span>${this.formatDate(date)}</span>
                    </div>
                    <div class="flex justify-between items-center py-3 border-b border-gray-200">
                        <span class="font-medium text-ricardo-dark">Hora:</span>
                        <span>${this.selectedSlot.time}</span>
                    </div>
                    <div class="flex justify-between items-center py-3 border-b border-gray-200">
                        <span class="font-medium text-ricardo-dark">Duración:</span>
                        <span>${this.selectedService.duracion} minutos</span>
                    </div>
                </div>
                
                <div class="space-y-4">
                    <div class="flex justify-between items-center py-3 border-b border-gray-200">
                        <span class="font-medium text-ricardo-dark">Cliente:</span>
                        <span>${name}</span>
                    </div>
                    <div class="flex justify-between items-center py-3 border-b border-gray-200">
                        <span class="font-medium text-ricardo-dark">Teléfono:</span>
                        <span>${phone}</span>
                    </div>
                    ${
                      email
                        ? `<div class="flex justify-between items-center py-3 border-b border-gray-200">
                        <span class="font-medium text-ricardo-dark">Email:</span>
                        <span>${email}</span>
                    </div>`
                        : ""
                    }
                    <div class="flex justify-between items-center py-3 text-xl font-bold">
                        <span class="text-ricardo-dark">Total:</span>
                        <span class="text-ricardo-gold">€${
                          this.selectedService.precio
                        }</span>
                    </div>
                </div>
            </div>
            
            ${
              notes
                ? `<div class="mt-8 p-4 bg-white rounded-lg">
                <span class="font-medium text-ricardo-dark">Comentarios especiales:</span>
                <p class="text-gray-600 mt-2">${notes}</p>
            </div>`
                : ""
            }
        `;
  }

  async confirmBooking() {
    try {
      this.showLoading();

      const bookingData = {
        service_id: this.selectedService.id_servicio,
        booking_date: document.getElementById("booking-date").value,
        booking_time: this.selectedSlot.time,
        client_name: document.getElementById("client-name").value,
        client_phone: document.getElementById("client-phone").value,
        client_email: document.getElementById("client-email").value || null,
        notes: document.getElementById("booking-notes").value || null,
      };

      // Simular creación de reserva
      await new Promise((resolve) => setTimeout(resolve, 2000));

      this.hideLoading();
      this.showSuccessModal({
        service_name: this.selectedService.nombre,
        booking_date: bookingData.booking_date,
        booking_time: bookingData.booking_time,
      });
      this.resetBookingForm();
    } catch (error) {
      this.hideLoading();
      console.error("Error confirming booking:", error);
      this.showAlert(
        "Error al procesar la reserva. Por favor intenta de nuevo.",
        "error",
      );
    }
  }

  async lookupBookings(phone) {
    try {
      this.showLoading();

      // Simular búsqueda de reservas
      await new Promise((resolve) => setTimeout(resolve, 1500));

      this.hideLoading();

      // Datos simulados
      const mockBookings = [
        {
          id: "1",
          service_name: "Corte Mujer",
          booking_date: "2024-01-15",
          booking_time: "10:00",
          duration: 120,
          price: 71,
          status: "confirmed",
        },
      ];

      this.renderBookingsList(mockBookings);
    } catch (error) {
      this.hideLoading();
      console.error("Error looking up bookings:", error);
    }
  }

  renderBookingsList(bookings) {
    const container = document.getElementById("bookings-list");

    if (bookings.length === 0) {
      container.innerHTML = `
                <div class="text-center py-12">
                    <i class="fas fa-calendar-times text-6xl text-gray-300 mb-6"></i>
                    <h3 class="font-serif text-2xl font-semibold text-ricardo-dark mb-4">No tienes reservas</h3>
                    <p class="text-gray-600 mb-8">¡Es el momento perfecto para agendar tu primera cita!</p>
                    <button class="btn-gold text-white px-8 py-4 rounded-xl font-medium" onclick="document.querySelector('[data-section=\\"booking\\"]').click()">
                        Reservar Ahora
                    </button>
                </div>
            `;
      return;
    }

    container.innerHTML = bookings
      .map(
        (booking) => `
            <div class="bg-white rounded-2xl luxury-shadow p-8 mb-6">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <h3 class="font-serif text-xl font-semibold text-ricardo-dark mb-2">${
                          booking.service_name
                        }</h3>
                        <div class="space-y-2 text-gray-600">
                            <p><i class="fas fa-calendar mr-2 text-ricardo-gold"></i>${this.formatDate(
                              booking.booking_date,
                            )}</p>
                            <p><i class="fas fa-clock mr-2 text-ricardo-gold"></i>${
                              booking.booking_time
                            } (${booking.duration} min)</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="inline-block px-4 py-2 rounded-full text-sm font-medium ${this.getStatusClass(
                          booking.status,
                        )}">
                            ${this.getStatusText(booking.status)}
                        </span>
                        <p class="text-2xl font-bold text-ricardo-gold mt-2">€${
                          booking.price
                        }</p>
                    </div>
                </div>
                ${
                  booking.status === "confirmed" &&
                  new Date(booking.booking_date) > new Date()
                    ? `
                    <div class="mt-6 pt-6 border-t border-gray-200">
                        <button class="text-red-600 hover:text-red-800 text-sm font-medium transition-colors" onclick="ricardoPortal.cancelBooking('${booking.id}')">
                            <i class="fas fa-times mr-2"></i>Cancelar Reserva
                        </button>
                    </div>
                `
                    : ""
                }
            </div>
        `,
      )
      .join("");
  }

  async submitContactForm(form) {
    try {
      this.showLoading();

      // Simular envío
      await new Promise((resolve) => setTimeout(resolve, 1500));

      this.hideLoading();
      this.showAlert(
        "Mensaje enviado correctamente. Te contactaremos pronto.",
        "success",
      );
      form.reset();
    } catch (error) {
      this.hideLoading();
      console.error("Error submitting contact form:", error);
      this.showAlert(
        "Error al enviar el mensaje. Por favor intenta de nuevo.",
        "error",
      );
    }
  }

  showSuccessModal(bookingData) {
    const modal = document.getElementById("success-modal");
    const message = document.getElementById("success-message");

    message.textContent = `Tu reserva para ${
      bookingData.service_name
    } el ${this.formatDate(bookingData.booking_date)} a las ${
      bookingData.booking_time
    } ha sido confirmada.`;

    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }

  resetBookingForm() {
    this.currentStep = 1;
    this.selectedService = null;
    this.selectedSlot = null;
    this.updateStepDisplay();
    this.updateStepIndicator(1);

    // Reset form fields
    document.getElementById("booking-form").reset();

    // Clear selections
    document.querySelectorAll(".service-option").forEach((opt) => {
      opt.classList.remove("border-ricardo-gold", "bg-ricardo-cream");
      opt.classList.add("border-gray-200");
    });
  }

  showLoading() {
    document.getElementById("loading-modal").classList.remove("hidden");
    document.getElementById("loading-modal").classList.add("flex");
  }

  hideLoading() {
    document.getElementById("loading-modal").classList.add("hidden");
    document.getElementById("loading-modal").classList.remove("flex");
  }

  showAlert(message, type = "info") {
    // Crear alerta temporal
    const alert = document.createElement("div");
    alert.className = `fixed top-4 right-4 z-50 p-4 rounded-xl text-white font-medium transition-all duration-300 transform translate-x-full`;

    switch (type) {
      case "success":
        alert.classList.add("bg-green-600");
        break;
      case "warning":
        alert.classList.add("bg-yellow-600");
        break;
      case "error":
        alert.classList.add("bg-red-600");
        break;
      default:
        alert.classList.add("bg-ricardo-gold");
    }

    alert.textContent = message;
    document.body.appendChild(alert);

    // Animar entrada
    setTimeout(() => {
      alert.classList.remove("translate-x-full");
    }, 100);

    // Remover después de 4 segundos
    setTimeout(() => {
      alert.classList.add("translate-x-full");
      setTimeout(() => {
        document.body.removeChild(alert);
      }, 300);
    }, 4000);
  }

  showErrorMessage(message) {
    const grid = document.getElementById("services-grid");
    grid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class="fas fa-exclamation-triangle text-6xl text-yellow-500 mb-6"></i>
                <h3 class="font-serif text-2xl font-semibold text-ricardo-dark mb-4">Error al cargar servicios</h3>
                <p class="text-gray-600 mb-8">${message}</p>
                <button class="btn-gold text-white px-8 py-4 rounded-xl font-medium" onclick="location.reload()">
                    Reintentar
                </button>
            </div>
        `;
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  getStatusClass(status) {
    const classes = {
      confirmed: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      cancelled: "bg-red-100 text-red-800",
      completed: "bg-blue-100 text-blue-800",
    };
    return classes[status] || "bg-gray-100 text-gray-800";
  }

  getStatusText(status) {
    const texts = {
      confirmed: "Confirmada",
      pending: "Pendiente",
      cancelled: "Cancelada",
      completed: "Completada",
    };
    return texts[status] || status;
  }

  async cancelBooking(bookingId) {
    if (!confirm("¿Estás seguro de que quieres cancelar esta reserva?")) {
      return;
    }

    try {
      this.showLoading();

      // Simular cancelación
      await new Promise((resolve) => setTimeout(resolve, 1500));

      this.hideLoading();
      this.showAlert("Reserva cancelada correctamente", "success");

      // Refresh bookings list
      const phone = document.getElementById("lookup-phone").value;
      if (phone) {
        this.lookupBookings(phone);
      }
    } catch (error) {
      this.hideLoading();
      console.error("Error cancelling booking:", error);
      this.showAlert(
        "Error al cancelar la reserva. Por favor intenta de nuevo.",
        "error",
      );
    }
  }
}

// Initialize the Ricardo client portal when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.ricardoPortal = new RicardoClientPortal();
});
