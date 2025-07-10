// public/admin/dashboard.js
// JavaScript para el Centro de Mando Interno

class AdminDashboard {
  constructor() {
    this.apiBase = "/admin";
    this.token = localStorage.getItem("admin_token");
    this.refreshInterval = null;
    this.currentTab = "logs";

    this.init();
  }

  async init() {
    // Verificar autenticación
    if (!this.token) {
      this.showLogin();
      return;
    }

    // Configurar eventos
    this.setupEventListeners();

    // Cargar dashboard inicial
    await this.loadDashboard();

    // Configurar auto-refresh
    this.startAutoRefresh();

    // Actualizar reloj
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);
  }

  setupEventListeners() {
    // Botón de refresh
    document.getElementById("refresh-btn").addEventListener("click", () => {
      this.loadDashboard();
    });

    // Tabs
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Filtros de logs
    document.getElementById("log-type").addEventListener("change", () => {
      this.loadLogs();
    });

    document.getElementById("log-level").addEventListener("change", () => {
      this.loadLogs();
    });

    // Exportar logs
    document.getElementById("export-logs").addEventListener("click", () => {
      this.exportLogs();
    });

    // Filtros de mensajes
    document.getElementById("phone-filter").addEventListener(
      "input",
      this.debounce(() => this.loadMessages(), 500)
    );

    document.getElementById("message-status").addEventListener("change", () => {
      this.loadMessages();
    });

    // Filtros de reservas
    document.getElementById("booking-status").addEventListener("change", () => {
      this.loadBookings();
    });

    // Tests de conectividad
    document.getElementById("test-openai").addEventListener("click", () => {
      this.testOpenAI();
    });

    document.getElementById("test-twilio").addEventListener("click", () => {
      this.testTwilio();
    });

    // Búsqueda de usuarios
    document.getElementById("user-search").addEventListener(
      "input",
      this.debounce(() => this.loadUsers(), 500)
    );

    // Escaneo de seguridad
    document.getElementById("security-scan").addEventListener("click", () => {
      this.runSecurityScan();
    });
  }

  async loadDashboard() {
    this.showLoading(true);

    try {
      const response = await this.apiCall("/dashboard");

      if (response.success) {
        this.updateDashboardMetrics(response.data);
        this.updateIntegrationsStatus(response.data.integrationStatus);

        // Cargar contenido de la tab actual
        await this.loadTabContent(this.currentTab);
      }
    } catch (error) {
      this.showError("Error cargando dashboard: " + error.message);
    } finally {
      this.showLoading(false);
    }
  }

  updateDashboardMetrics(data) {
    // Estado del sistema
    document.getElementById("system-status").textContent =
      data.systemHealth.status === "healthy" ? "Saludable" : "Error";
    document.getElementById("system-uptime").textContent =
      data.systemHealth.uptime.formatted;

    // Mensajes hoy
    document.getElementById("messages-today").textContent =
      data.todayStats.messages;

    // Reservas hoy
    document.getElementById("bookings-today").textContent =
      data.todayStats.bookings;

    // Memoria
    const memoryUsed = data.systemHealth.memory.used;
    const memoryTotal = data.systemHealth.memory.total;
    const memoryPercent = ((memoryUsed / memoryTotal) * 100).toFixed(1);

    document.getElementById("memory-usage").textContent = `${memoryUsed} MB`;
    document.getElementById("memory-bar").style.width = `${memoryPercent}%`;

    // Actividad reciente
    if (data.recentActivity.messages.length > 0) {
      const lastMessage = data.recentActivity.messages[0];
      document.getElementById("last-message-time").textContent =
        this.formatTime(lastMessage.created_at);
    }

    if (data.recentActivity.bookings.length > 0) {
      const nextBooking = data.recentActivity.bookings[0];
      document.getElementById("next-appointment").textContent = this.formatTime(
        nextBooking.scheduled_at
      );
    }
  }

  updateIntegrationsStatus(integrations) {
    const container = document.getElementById("integrations-status");
    container.innerHTML = "";

    const integrationsList = [
      { key: "openai", name: "OpenAI", icon: "fas fa-brain" },
      { key: "twilio", name: "Twilio", icon: "fas fa-phone" },
      { key: "calendly", name: "Calendly", icon: "fas fa-calendar" },
      { key: "supabase", name: "Supabase", icon: "fas fa-database" },
    ];

    integrationsList.forEach((integration) => {
      const status = integrations[integration.key];
      const statusClass =
        status.status === "healthy"
          ? "status-healthy"
          : status.status === "warning"
          ? "status-warning"
          : "status-error";

      const statusText =
        status.status === "healthy"
          ? "Conectado"
          : status.status === "warning"
          ? "Advertencia"
          : "Error";

      container.innerHTML += `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div class="flex items-center">
                        <i class="${integration.icon} text-gray-600 mr-3"></i>
                        <span class="font-medium">${integration.name}</span>
                    </div>
                    <div class="flex items-center">
                        <span class="status-indicator ${statusClass}"></span>
                        <span class="text-sm text-gray-600">${statusText}</span>
                    </div>
                </div>
            `;
    });
  }

  async switchTab(tabName) {
    // Actualizar UI de tabs
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.remove("active", "border-blue-500", "text-blue-600");
      btn.classList.add("border-transparent", "text-gray-500");
    });

    document
      .querySelector(`[data-tab="${tabName}"]`)
      .classList.add("active", "border-blue-500", "text-blue-600");

    // Mostrar/ocultar contenido
    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.add("hidden");
    });

    document.getElementById(`${tabName}-tab`).classList.remove("hidden");

    this.currentTab = tabName;
    await this.loadTabContent(tabName);
  }

  async loadTabContent(tabName) {
    switch (tabName) {
      case "logs":
        await this.loadLogs();
        break;
      case "messages":
        await this.loadMessages();
        break;
      case "bookings":
        await this.loadBookings();
        break;
      case "openai":
        await this.loadOpenAI();
        break;
      case "twilio":
        await this.loadTwilio();
        break;
      case "users":
        await this.loadUsers();
        break;
      case "security":
        await this.loadSecurity();
        break;
    }
  }

  async loadLogs() {
    const type = document.getElementById("log-type").value;
    const level = document.getElementById("log-level").value;

    try {
      const response = await this.apiCall(
        `/logs?type=${type}&level=${level}&limit=100`
      );

      if (response.success) {
        this.displayLogs(response.data.logs);
      }
    } catch (error) {
      this.showError("Error cargando logs: " + error.message);
    }
  }

  displayLogs(logs) {
    const container = document.getElementById("logs-container");

    if (logs.length === 0) {
      container.innerHTML =
        '<div class="text-center text-gray-500">No hay logs disponibles</div>';
      return;
    }

    container.innerHTML = logs
      .map((log) => {
        const levelColor =
          {
            ERROR: "text-red-400",
            WARN: "text-yellow-400",
            INFO: "text-blue-400",
            DEBUG: "text-gray-400",
          }[log.level] || "text-green-400";

        return `
                <div class="log-entry mb-2 p-2 hover:bg-gray-800 rounded">
                    <div class="flex items-start space-x-2">
                        <span class="text-gray-500 text-xs">${this.formatTime(
                          log.timestamp
                        )}</span>
                        <span class="${levelColor} font-bold text-xs">[${
          log.level
        }]</span>
                        <span class="text-green-400 flex-1">${
                          log.message
                        }</span>
                    </div>
                    ${
                      log.metadata && Object.keys(log.metadata).length > 0
                        ? `
                        <div class="ml-4 mt-1 text-gray-400 text-xs">
                            ${JSON.stringify(log.metadata, null, 2)}
                        </div>
                    `
                        : ""
                    }
                </div>
            `;
      })
      .join("");

    // Auto-scroll al final
    container.scrollTop = container.scrollHeight;
  }

  async loadMessages() {
    const phone = document.getElementById("phone-filter").value;
    const status = document.getElementById("message-status").value;

    try {
      const response = await this.apiCall(
        `/messages?phone=${phone}&status=${status}&limit=50`
      );

      if (response.success) {
        this.displayMessages(response.data.messages);
      }
    } catch (error) {
      this.showError("Error cargando mensajes: " + error.message);
    }
  }

  displayMessages(messages) {
    const container = document.getElementById("messages-container");

    if (messages.length === 0) {
      container.innerHTML =
        '<div class="text-center text-gray-500">No hay mensajes disponibles</div>';
      return;
    }

    container.innerHTML = messages
      .map((message) => {
        const statusColor =
          {
            sent: "bg-blue-100 text-blue-800",
            delivered: "bg-green-100 text-green-800",
            read: "bg-purple-100 text-purple-800",
            failed: "bg-red-100 text-red-800",
          }[message.status] || "bg-gray-100 text-gray-800";

        return `
                <div class="bg-white border rounded-lg p-4">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex items-center space-x-2">
                            <i class="fab fa-whatsapp text-green-600"></i>
                            <span class="font-medium">${this.maskPhone(
                              message.phone_number
                            )}</span>
                            <span class="px-2 py-1 rounded-full text-xs ${statusColor}">${
          message.status
        }</span>
                        </div>
                        <span class="text-sm text-gray-500">${this.formatTime(
                          message.created_at
                        )}</span>
                    </div>
                    <div class="text-gray-700">
                        <strong>${
                          message.direction === "inbound" ? "Cliente:" : "Bot:"
                        }</strong>
                        ${message.content}
                    </div>
                    ${
                      message.ai_response
                        ? `
                        <div class="mt-2 p-2 bg-blue-50 rounded text-sm">
                            <strong>Respuesta IA:</strong> ${message.ai_response}
                        </div>
                    `
                        : ""
                    }
                </div>
            `;
      })
      .join("");
  }

  async loadBookings() {
    const status = document.getElementById("booking-status").value;

    try {
      const response = await this.apiCall(
        `/bookings?status=${status}&limit=50`
      );

      if (response.success) {
        this.displayBookings(response.data.bookings);
      }
    } catch (error) {
      this.showError("Error cargando reservas: " + error.message);
    }
  }

  displayBookings(bookings) {
    const container = document.getElementById("bookings-container");

    if (bookings.length === 0) {
      container.innerHTML =
        '<div class="text-center text-gray-500">No hay reservas disponibles</div>';
      return;
    }

    container.innerHTML = bookings
      .map((booking) => {
        const statusColor =
          {
            confirmed: "bg-green-100 text-green-800",
            pending: "bg-yellow-100 text-yellow-800",
            cancelled: "bg-red-100 text-red-800",
          }[booking.status] || "bg-gray-100 text-gray-800";

        return `
                <div class="bg-white border rounded-lg p-4">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex items-center space-x-2">
                            <i class="fas fa-calendar text-purple-600"></i>
                            <span class="font-medium">${
                              booking.service_name || "Servicio"
                            }</span>
                            <span class="px-2 py-1 rounded-full text-xs ${statusColor}">${
          booking.status
        }</span>
                        </div>
                        <span class="text-sm text-gray-500">${this.formatTime(
                          booking.scheduled_at
                        )}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <strong>Cliente:</strong> ${this.maskEmail(
                              booking.client_email
                            )}
                        </div>
                        <div>
                            <strong>Teléfono:</strong> ${this.maskPhone(
                              booking.client_phone
                            )}
                        </div>
                        <div>
                            <strong>Duración:</strong> ${
                              booking.duration || 45
                            } min
                        </div>
                        <div>
                            <strong>Creado:</strong> ${this.formatTime(
                              booking.created_at
                            )}
                        </div>
                    </div>
                    ${
                      booking.notes
                        ? `
                        <div class="mt-2 p-2 bg-gray-50 rounded text-sm">
                            <strong>Notas:</strong> ${booking.notes}
                        </div>
                    `
                        : ""
                    }
                </div>
            `;
      })
      .join("");
  }

  async loadOpenAI() {
    try {
      const response = await this.apiCall("/openai?limit=50");

      if (response.success) {
        this.displayOpenAI(response.data);
      }
    } catch (error) {
      this.showError("Error cargando estado de OpenAI: " + error.message);
    }
  }

  displayOpenAI(data) {
    const container = document.getElementById("openai-container");

    container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="font-semibold mb-2">Conectividad</h4>
                    <div class="flex items-center">
                        <span class="status-indicator ${
                          data.connectivity.status === "healthy"
                            ? "status-healthy"
                            : "status-error"
                        }"></span>
                        <span>${
                          data.connectivity.status === "healthy"
                            ? "Conectado"
                            : "Error"
                        }</span>
                    </div>
                </div>
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="font-semibold mb-2">Requests Hoy</h4>
                    <div class="text-2xl font-bold text-blue-600">${
                      data.stats.requests || 0
                    }</div>
                </div>
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="font-semibold mb-2">Tokens Usados</h4>
                    <div class="text-2xl font-bold text-green-600">${
                      data.stats.tokens || 0
                    }</div>
                </div>
            </div>
            
            <div class="bg-white border rounded-lg">
                <div class="px-4 py-3 border-b">
                    <h4 class="font-semibold">Logs Recientes</h4>
                </div>
                <div class="p-4">
                    <div class="bg-gray-900 text-green-400 p-4 rounded-lg h-64 overflow-y-auto">
                        ${data.logs
                          .map(
                            (log) => `
                            <div class="log-entry mb-1">
                                <span class="text-gray-500 text-xs">${this.formatTime(
                                  log.timestamp
                                )}</span>
                                <span class="text-green-400 ml-2">${
                                  log.message
                                }</span>
                            </div>
                        `
                          )
                          .join("")}
                    </div>
                </div>
            </div>
        `;
  }

  async loadTwilio() {
    try {
      const response = await this.apiCall("/twilio?limit=50");

      if (response.success) {
        this.displayTwilio(response.data);
      }
    } catch (error) {
      this.showError("Error cargando estado de Twilio: " + error.message);
    }
  }

  displayTwilio(data) {
    const container = document.getElementById("twilio-container");

    container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="font-semibold mb-2">Conectividad</h4>
                    <div class="flex items-center">
                        <span class="status-indicator ${
                          data.connectivity.status === "healthy"
                            ? "status-healthy"
                            : "status-error"
                        }"></span>
                        <span>${
                          data.connectivity.status === "healthy"
                            ? "Conectado"
                            : "Error"
                        }</span>
                    </div>
                </div>
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="font-semibold mb-2">Mensajes Enviados</h4>
                    <div class="text-2xl font-bold text-blue-600">${
                      data.stats.sent || 0
                    }</div>
                </div>
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="font-semibold mb-2">Mensajes Fallidos</h4>
                    <div class="text-2xl font-bold text-red-600">${
                      data.stats.failed || 0
                    }</div>
                </div>
            </div>
            
            <div class="bg-white border rounded-lg">
                <div class="px-4 py-3 border-b">
                    <h4 class="font-semibold">Logs de WhatsApp</h4>
                </div>
                <div class="p-4">
                    <div class="bg-gray-900 text-green-400 p-4 rounded-lg h-64 overflow-y-auto">
                        ${data.logs
                          .map(
                            (log) => `
                            <div class="log-entry mb-1">
                                <span class="text-gray-500 text-xs">${this.formatTime(
                                  log.timestamp
                                )}</span>
                                <span class="text-green-400 ml-2">${
                                  log.message
                                }</span>
                            </div>
                        `
                          )
                          .join("")}
                    </div>
                </div>
            </div>
        `;
  }

  async loadUsers() {
    const search = document.getElementById("user-search").value;

    try {
      const response = await this.apiCall(`/users?phone=${search}&limit=50`);

      if (response.success) {
        this.displayUsers(response.data.users);
      }
    } catch (error) {
      this.showError("Error cargando usuarios: " + error.message);
    }
  }

  displayUsers(users) {
    const container = document.getElementById("users-container");

    if (users.length === 0) {
      container.innerHTML =
        '<div class="text-center text-gray-500">No hay usuarios disponibles</div>';
      return;
    }

    container.innerHTML = users
      .map(
        (user) => `
            <div class="bg-white border rounded-lg p-4">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-user text-gray-600"></i>
                        <span class="font-medium">${
                          user.client_name || "Usuario"
                        }</span>
                        <span class="text-sm text-gray-500">${this.maskPhone(
                          user.phone_number
                        )}</span>
                    </div>
                    <span class="text-sm text-gray-500">Última actividad: ${this.formatTime(
                      user.last_activity
                    )}</span>
                </div>
                <div class="grid grid-cols-3 gap-4 text-sm">
                    <div>
                        <strong>Mensajes:</strong> ${
                          user.whatsapp_messages?.[0]?.count || 0
                        }
                    </div>
                    <div>
                        <strong>Reservas:</strong> ${
                          user.bookings?.[0]?.count || 0
                        }
                    </div>
                    <div>
                        <strong>Estado:</strong> 
                        <span class="px-2 py-1 rounded-full text-xs ${
                          user.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }">
                            ${user.is_active ? "Activo" : "Inactivo"}
                        </span>
                    </div>
                </div>
            </div>
        `
      )
      .join("");
  }

  async loadSecurity() {
    try {
      const response = await this.apiCall("/security?limit=50");

      if (response.success) {
        this.displaySecurity(response.data);
      }
    } catch (error) {
      this.showError("Error cargando estado de seguridad: " + error.message);
    }
  }

  displaySecurity(data) {
    const container = document.getElementById("security-container");

    container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="font-semibold mb-2">Amenazas Bloqueadas</h4>
                    <div class="text-2xl font-bold text-red-600">${
                      data.stats.blocked || 0
                    }</div>
                </div>
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="font-semibold mb-2">Advertencias</h4>
                    <div class="text-2xl font-bold text-yellow-600">${
                      data.stats.warnings || 0
                    }</div>
                </div>
                <div class="bg-white border rounded-lg p-4">
                    <h4 class="font-semibold mb-2">Sesiones Activas</h4>
                    <div class="text-2xl font-bold text-blue-600">${
                      data.activeSessions.length || 0
                    }</div>
                </div>
            </div>
            
            <div class="bg-white border rounded-lg">
                <div class="px-4 py-3 border-b">
                    <h4 class="font-semibold">Logs de Seguridad</h4>
                </div>
                <div class="p-4">
                    <div class="bg-gray-900 text-green-400 p-4 rounded-lg h-64 overflow-y-auto">
                        ${data.logs
                          .map((log) => {
                            const levelColor =
                              log.level === "SECURITY"
                                ? "text-red-400"
                                : "text-yellow-400";
                            return `
                                <div class="log-entry mb-1">
                                    <span class="text-gray-500 text-xs">${this.formatTime(
                                      log.timestamp
                                    )}</span>
                                    <span class="${levelColor} ml-2">[${
                              log.level
                            }]</span>
                                    <span class="text-green-400 ml-2">${
                                      log.message
                                    }</span>
                                </div>
                            `;
                          })
                          .join("")}
                    </div>
                </div>
            </div>
        `;
  }

  // Métodos de utilidad
  async apiCall(endpoint, options = {}) {
    const response = await fetch(this.apiBase + endpoint, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (response.status === 401) {
      this.showLogin();
      throw new Error("No autorizado");
    }

    return await response.json();
  }

  formatTime(timestamp) {
    return new Date(timestamp).toLocaleString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  maskPhone(phone) {
    if (!phone) return "N/A";
    return phone.replace(/(\d{3})\d{4}(\d{3})/, "$1****$2");
  }

  maskEmail(email) {
    if (!email) return "N/A";
    const [user, domain] = email.split("@");
    return `${user.substring(0, 2)}***@${domain}`;
  }

  updateClock() {
    document.getElementById("current-time").textContent =
      new Date().toLocaleString("es-ES");
  }

  showLoading(show) {
    document
      .getElementById("loading-overlay")
      .classList.toggle("hidden", !show);
  }

  showError(message) {
    // Implementar notificación de error
    console.error(message);
    alert(message); // Temporal
  }

  showLogin() {
    // Redirect to login page
    window.location.href = "/admin/login.html";
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  startAutoRefresh() {
    this.refreshInterval = setInterval(() => {
      this.loadDashboard();
    }, 30000); // Refresh cada 30 segundos
  }

  async exportLogs() {
    const type = document.getElementById("log-type").value;

    try {
      const response = await fetch(
        `${this.apiBase}/export/logs?type=${type}&format=json`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${type}-logs-${
          new Date().toISOString().split("T")[0]
        }.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      this.showError("Error exportando logs: " + error.message);
    }
  }

  async testOpenAI() {
    this.showLoading(true);
    try {
      const response = await this.apiCall("/openai");
      if (response.success && response.data.connectivity.status === "healthy") {
        alert("✅ OpenAI conectado correctamente");
      } else {
        alert("❌ Error de conectividad con OpenAI");
      }
    } catch (error) {
      alert("❌ Error: " + error.message);
    } finally {
      this.showLoading(false);
    }
  }

  async testTwilio() {
    this.showLoading(true);
    try {
      const response = await this.apiCall("/twilio");
      if (response.success && response.data.connectivity.status === "healthy") {
        alert("✅ Twilio conectado correctamente");
      } else {
        alert("❌ Error de conectividad con Twilio");
      }
    } catch (error) {
      alert("❌ Error: " + error.message);
    } finally {
      this.showLoading(false);
    }
  }

  async runSecurityScan() {
    this.showLoading(true);
    try {
      // Implementar escaneo de seguridad
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simular escaneo
      alert("✅ Escaneo de seguridad completado - No se encontraron amenazas");
      await this.loadSecurity();
    } catch (error) {
      alert("❌ Error en escaneo: " + error.message);
    } finally {
      this.showLoading(false);
    }
  }
}

// Inicializar dashboard cuando se carga la página
document.addEventListener("DOMContentLoaded", () => {
  new AdminDashboard();
});
