// public/client/client.js
// Portal del Cliente - Ricardo Buriticá

class ClientPortal {
  constructor() {
    this.currentStep = 1;
    this.maxSteps = 4;
    this.selectedService = null;
    this.selectedSlot = null;
    this.bookingData = {};

    this.init();
  }

  init() {
    this.setupNavigation();
    this.setupBookingForm();
    this.loadServices();
    this.setupEventListeners();
  }

  setupNavigation() {
    const navButtons = document.querySelectorAll(".nav-btn");
    const sections = document.querySelectorAll(".section");

    navButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetSection = btn.dataset.section;

        // Update nav buttons
        navButtons.forEach((b) => {
          b.classList.remove("active", "border-blue-500", "text-blue-600");
          b.classList.add("border-transparent", "text-gray-500");
        });
        btn.classList.add("active", "border-blue-500", "text-blue-600");
        btn.classList.remove("border-transparent", "text-gray-500");

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
        this.loadAvailableSlots(this.selectedService.id, e.target.value);
      }
    });
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

  async loadServices() {
    try {
      const response = await fetch("/api/services");
      const result = await response.json();

      if (result.success) {
        this.renderServices(result.data);
        this.renderServiceSelection(result.data);
      } else {
        console.error("Error loading services:", result.error);
      }
    } catch (error) {
      console.error("Error loading services:", error);
    }
  }

  renderServices(services) {
    const grid = document.getElementById("services-grid");
    grid.innerHTML = "";

    services.forEach((service) => {
      const card = document.createElement("div");
      card.className = "service-card bg-white rounded-lg shadow-lg p-6";
      card.innerHTML = `
                <div class="text-center">
                    <div class="text-4xl mb-4">${this.getServiceIcon(
                      service.name
                    )}</div>
                    <h3 class="text-xl font-semibold mb-2">${service.name}</h3>
                    <p class="text-gray-600 mb-4">${
                      service.description ||
                      "Servicio profesional de alta calidad"
                    }</p>
                    <div class="flex justify-between items-center mb-4">
                        <span class="text-sm text-gray-500">
                            <i class="fas fa-clock mr-1"></i>${
                              service.duration_minutes
                            } min
                        </span>
                        <span class="text-2xl font-bold text-blue-600">€${
                          service.price
                        }</span>
                    </div>
                    <button class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors book-service-btn" data-service-id="${
                      service.id
                    }">
                        Reservar Ahora
                    </button>
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
        "service-option p-4 border border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50";
      option.dataset.serviceId = service.id;
      option.innerHTML = `
                <div class="flex items-center justify-between">
                    <div>
                        <h4 class="font-semibold">${service.name}</h4>
                        <p class="text-sm text-gray-600">${service.duration_minutes} min</p>
                    </div>
                    <div class="text-right">
                        <span class="text-lg font-bold text-blue-600">€${service.price}</span>
                    </div>
                </div>
            `;

      option.addEventListener("click", () => {
        // Remove selection from others
        container.querySelectorAll(".service-option").forEach((opt) => {
          opt.classList.remove("border-blue-500", "bg-blue-50");
          opt.classList.add("border-gray-300");
        });

        // Select this one
        option.classList.add("border-blue-500", "bg-blue-50");
        option.classList.remove("border-gray-300");

        this.selectedService = service;
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
        `[data-service-id="${service.id}"]`
      );
      if (serviceOption) {
        serviceOption.click();
      }
    }, 100);
  }

  async loadAvailableSlots(serviceId, date) {
    try {
      this.showLoading();

      const response = await fetch(
        `/api/availability/${serviceId}?date=${date}&days=1`
      );
      const result = await response.json();

      this.hideLoading();

      if (result.success) {
        this.renderAvailableSlots(result.data.slots || []);
      } else {
        console.error("Error loading slots:", result.error);
        this.renderAvailableSlots([]);
      }
    } catch (error) {
      this.hideLoading();
      console.error("Error loading slots:", error);
      this.renderAvailableSlots([]);
    }
  }

  renderAvailableSlots(slots) {
    const container = document.getElementById("available-slots");
    container.innerHTML = "";

    if (slots.length === 0) {
      container.innerHTML =
        '<p class="text-gray-500 col-span-3 text-center py-4">No hay horarios disponibles para esta fecha</p>';
      return;
    }

    slots.forEach((slot) => {
      const slotBtn = document.createElement("button");
      slotBtn.type = "button";
      slotBtn.className =
        "booking-slot p-2 text-sm border border-gray-300 rounded hover:bg-gray-50";
      slotBtn.textContent = slot.time;
      slotBtn.dataset.slot = JSON.stringify(slot);

      slotBtn.addEventListener("click", () => {
        // Remove selection from others
        container.querySelectorAll(".booking-slot").forEach((btn) => {
          btn.classList.remove("selected", "bg-blue-600", "text-white");
          btn.classList.add("border-gray-300");
        });

        // Select this one
        slotBtn.classList.add("selected", "bg-blue-600", "text-white");
        slotBtn.classList.remove("border-gray-300");

        this.selectedSlot = slot;
      });

      container.appendChild(slotBtn);
    });
  }

  nextStep() {
    if (!this.validateCurrentStep()) {
      return;
    }

    if (this.currentStep < this.maxSteps) {
      this.currentStep++;
      this.updateStepDisplay();

      if (this.currentStep === 4) {
        this.showBookingSummary();
      }
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateStepDisplay();
    }
  }

  validateCurrentStep() {
    switch (this.currentStep) {
      case 1:
        if (!this.selectedService) {
          alert("Por favor selecciona un servicio");
          return false;
        }
        break;
      case 2:
        const date = document.getElementById("booking-date").value;
        if (!date || !this.selectedSlot) {
          alert("Por favor selecciona fecha y hora");
          return false;
        }
        break;
      case 3:
        const name = document.getElementById("client-name").value;
        const phone = document.getElementById("client-phone").value;
        if (!name || !phone) {
          alert("Por favor completa los campos obligatorios");
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

  getStepName() {
    const steps = ["service", "datetime", "info", "confirm"];
    return steps[this.currentStep - 1];
  }

  showBookingSummary() {
    const summary = document.getElementById("booking-summary");
    const date = document.getElementById("booking-date").value;
    const name = document.getElementById("client-name").value;
    const phone = document.getElementById("client-phone").value;
    const email = document.getElementById("client-email").value;
    const notes = document.getElementById("booking-notes").value;

    summary.innerHTML = `
            <h4 class="font-semibold mb-4">Resumen de tu reserva:</h4>
            <div class="space-y-3">
                <div class="flex justify-between">
                    <span class="font-medium">Servicio:</span>
                    <span>${this.selectedService.name}</span>
                </div>
                <div class="flex justify-between">
                    <span class="font-medium">Fecha:</span>
                    <span>${this.formatDate(date)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="font-medium">Hora:</span>
                    <span>${this.selectedSlot.time}</span>
                </div>
                <div class="flex justify-between">
                    <span class="font-medium">Duración:</span>
                    <span>${
                      this.selectedService.duration_minutes
                    } minutos</span>
                </div>
                <div class="flex justify-between">
                    <span class="font-medium">Cliente:</span>
                    <span>${name}</span>
                </div>
                <div class="flex justify-between">
                    <span class="font-medium">Teléfono:</span>
                    <span>${phone}</span>
                </div>
                ${
                  email
                    ? `<div class="flex justify-between">
                    <span class="font-medium">Email:</span>
                    <span>${email}</span>
                </div>`
                    : ""
                }
                <hr class="my-4">
                <div class="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span class="text-blue-600">€${
                      this.selectedService.price
                    }</span>
                </div>
                ${
                  notes
                    ? `<div class="mt-4">
                    <span class="font-medium">Notas:</span>
                    <p class="text-gray-600 mt-1">${notes}</p>
                </div>`
                    : ""
                }
            </div>
        `;
  }

  async confirmBooking() {
    try {
      this.showLoading();

      const bookingData = {
        service_id: this.selectedService.id,
        booking_date: document.getElementById("booking-date").value,
        booking_time: this.selectedSlot.time,
        client_name: document.getElementById("client-name").value,
        client_phone: document.getElementById("client-phone").value,
        client_email: document.getElementById("client-email").value || null,
        notes: document.getElementById("booking-notes").value || null,
      };

      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bookingData),
      });

      const result = await response.json();
      this.hideLoading();

      if (result.success) {
        this.showSuccessModal(result.data);
        this.resetBookingForm();
      } else {
        alert("Error al crear la reserva: " + result.error);
      }
    } catch (error) {
      this.hideLoading();
      console.error("Error confirming booking:", error);
      alert("Error al procesar la reserva. Por favor intenta de nuevo.");
    }
  }

  async lookupBookings(phone) {
    try {
      this.showLoading();

      const response = await fetch(
        `/api/bookings/client/${encodeURIComponent(phone)}`
      );
      const result = await response.json();

      this.hideLoading();

      if (result.success) {
        this.renderBookingsList(result.data);
      } else {
        document.getElementById("bookings-list").innerHTML = `
                    <div class="text-center py-8">
                        <p class="text-gray-500">No se encontraron reservas para este número</p>
                    </div>
                `;
      }
    } catch (error) {
      this.hideLoading();
      console.error("Error looking up bookings:", error);
    }
  }

  renderBookingsList(bookings) {
    const container = document.getElementById("bookings-list");

    if (bookings.length === 0) {
      container.innerHTML = `
                <div class="text-center py-8">
                    <p class="text-gray-500">No tienes reservas registradas</p>
                </div>
            `;
      return;
    }

    container.innerHTML = bookings
      .map(
        (booking) => `
            <div class="bg-white rounded-lg shadow-lg p-6 mb-4">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="text-lg font-semibold">${
                          booking.service_name
                        }</h3>
                        <p class="text-gray-600">${this.formatDate(
                          booking.booking_date
                        )} a las ${booking.booking_time}</p>
                        <p class="text-sm text-gray-500">Duración: ${
                          booking.duration
                        } minutos</p>
                        ${
                          booking.notes
                            ? `<p class="text-sm text-gray-600 mt-2">Notas: ${booking.notes}</p>`
                            : ""
                        }
                    </div>
                    <div class="text-right">
                        <span class="inline-block px-3 py-1 rounded-full text-sm font-medium ${this.getStatusClass(
                          booking.status
                        )}">
                            ${this.getStatusText(booking.status)}
                        </span>
                        <p class="text-lg font-bold text-blue-600 mt-2">€${
                          booking.price
                        }</p>
                    </div>
                </div>
                ${
                  booking.status === "confirmed" &&
                  new Date(booking.booking_date) > new Date()
                    ? `
                    <div class="mt-4 pt-4 border-t">
                        <button class="text-red-600 hover:text-red-800 text-sm" onclick="clientPortal.cancelBooking('${booking.id}')">
                            <i class="fas fa-times mr-1"></i>Cancelar Reserva
                        </button>
                    </div>
                `
                    : ""
                }
            </div>
        `
      )
      .join("");
  }

  async submitContactForm(form) {
    try {
      this.showLoading();

      const formData = new FormData(form);
      const data = Object.fromEntries(formData);

      // Simulate form submission
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.hideLoading();
      alert("Mensaje enviado correctamente. Te contactaremos pronto.");
      form.reset();
    } catch (error) {
      this.hideLoading();
      console.error("Error submitting contact form:", error);
      alert("Error al enviar el mensaje. Por favor intenta de nuevo.");
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

    // Reset form fields
    document.getElementById("booking-form").reset();

    // Clear selections
    document.querySelectorAll(".service-option").forEach((opt) => {
      opt.classList.remove("border-blue-500", "bg-blue-50");
      opt.classList.add("border-gray-300");
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

  getServiceIcon(serviceName) {
    const icons = {
      "Corte de Cabello": "✂️",
      Peinado: "💇‍♀️",
      "Tratamiento Capilar": "🧴",
      Manicura: "💅",
      Pedicura: "🦶",
    };
    return icons[serviceName] || "✨";
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

      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "PUT",
      });

      const result = await response.json();
      this.hideLoading();

      if (result.success) {
        alert("Reserva cancelada correctamente");
        // Refresh bookings list
        const phone = document.getElementById("lookup-phone").value;
        if (phone) {
          this.lookupBookings(phone);
        }
      } else {
        alert("Error al cancelar la reserva: " + result.error);
      }
    } catch (error) {
      this.hideLoading();
      console.error("Error cancelling booking:", error);
      alert("Error al cancelar la reserva. Por favor intenta de nuevo.");
    }
  }
}

// Initialize the client portal when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.clientPortal = new ClientPortal();
});
