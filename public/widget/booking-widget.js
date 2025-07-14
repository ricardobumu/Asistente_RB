// Booking Widget JavaScript - Ricardo Buriticá Beauty Consulting

class BookingWidget {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 5;
        this.selectedService = null;
        this.selectedDate = null;
        this.selectedTime = null;
        this.clientData = {};
        this.currentMonth = new Date();
        this.availableDates = [];
        this.availableTimes = [];
        
        // API Base URL - se puede configurar
        this.apiBaseUrl = window.BOOKING_API_URL || '/api';
        
        this.init();
    }

    init() {
        this.loadServices();
        this.setupEventListeners();
        this.updateNavigation();
        this.generateCalendar();
    }

    setupEventListeners() {
        // Form submission
        const clientForm = document.getElementById('client-form');
        if (clientForm) {
            clientForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleClientFormSubmit();
            });
        }

        // Phone number formatting
        const phoneInput = document.getElementById('client-phone');
        if (phoneInput) {
            phoneInput.addEventListener('input', this.formatPhoneNumber.bind(this));
        }

        // Real-time validation
        const requiredInputs = document.querySelectorAll('input[required], textarea[required]');
        requiredInputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearFieldError(input));
        });
    }

    async loadServices() {
        try {
            this.showLoading('services-list');
            
            const response = await fetch(`${this.apiBaseUrl}/services/public`);
            if (!response.ok) throw new Error('Error loading services');
            
            const result = await response.json();
            const services = result.data || [];
            
            this.renderServices(services);
        } catch (error) {
            console.error('Error loading services:', error);
            this.showError('services-list', 'Error cargando servicios. Por favor, recarga la página.');
        }
    }

    renderServices(services) {
        const container = document.getElementById('services-list');
        
        if (services.length === 0) {
            container.innerHTML = `
                <div class="no-services">
                    <i class="fas fa-info-circle"></i>
                    <p>No hay servicios disponibles en este momento</p>
                </div>
            `;
            return;
        }

        container.innerHTML = services.map(service => `
            <div class="service-card" data-service-id="${service.id}" onclick="selectService(${service.id})">
                <div class="service-header">
                    <div>
                        <div class="service-name">${service.name}</div>
                        <div class="service-description">${service.description || ''}</div>
                    </div>
                    <div class="service-price">€${service.price}</div>
                </div>
                <div class="service-details">
                    <div class="service-detail">
                        <i class="fas fa-clock"></i>
                        <span>${service.duration} min</span>
                    </div>
                    ${service.category ? `
                        <div class="service-detail">
                            <i class="fas fa-tag"></i>
                            <span>${service.category}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    selectService(serviceId) {
        // Remove previous selection
        document.querySelectorAll('.service-card').forEach(card => {
            card.classList.remove('selected');
        });

        // Add selection to clicked card
        const selectedCard = document.querySelector(`[data-service-id="${serviceId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
            
            // Store service data
            this.selectedService = {
                id: serviceId,
                name: selectedCard.querySelector('.service-name').textContent,
                price: selectedCard.querySelector('.service-price').textContent,
                duration: selectedCard.querySelector('.service-detail span').textContent,
                description: selectedCard.querySelector('.service-description').textContent
            };

            this.updateNavigation();
        }
    }

    generateCalendar() {
        const container = document.getElementById('calendar-grid');
        const monthDisplay = document.getElementById('current-month');
        
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        
        // Update month display
        monthDisplay.textContent = this.currentMonth.toLocaleDateString('es-ES', {
            month: 'long',
            year: 'numeric'
        });

        // Clear container
        container.innerHTML = '';

        // Add day headers
        const dayHeaders = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        dayHeaders.forEach(day => {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day header';
            dayElement.textContent = day;
            container.appendChild(dayElement);
        });

        // Get first day of month and number of days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        // Generate calendar days
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < 42; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = currentDate.getDate();
            
            // Add appropriate classes
            if (currentDate.getMonth() !== month) {
                dayElement.classList.add('other-month');
                dayElement.style.opacity = '0.3';
            } else if (currentDate < today) {
                dayElement.classList.add('unavailable');
            } else {
                dayElement.classList.add('available');
                dayElement.onclick = () => this.selectDate(currentDate);
            }
            
            if (currentDate.toDateString() === today.toDateString()) {
                dayElement.classList.add('today');
            }
            
            if (this.selectedDate && currentDate.toDateString() === this.selectedDate.toDateString()) {
                dayElement.classList.add('selected');
            }
            
            container.appendChild(dayElement);
        }
    }

    selectDate(date) {
        // Remove previous selection
        document.querySelectorAll('.calendar-day').forEach(day => {
            day.classList.remove('selected');
        });

        // Add selection
        event.target.classList.add('selected');
        this.selectedDate = date;
        
        // Update selected date display
        document.getElementById('selected-date-display').textContent = 
            date.toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

        // Load available times for selected date
        this.loadAvailableTimes();
        this.updateNavigation();
    }

    async loadAvailableTimes() {
        if (!this.selectedService || !this.selectedDate) return;

        try {
            this.showLoading('time-slots');
            
            const dateStr = this.selectedDate.toISOString().split('T')[0];
            const response = await fetch(
                `${this.apiBaseUrl}/bookings/availability/${this.selectedService.id}?date=${dateStr}`
            );
            
            if (!response.ok) throw new Error('Error loading available times');
            
            const result = await response.json();
            const availableTimes = result.data || [];
            
            this.renderAvailableTimes(availableTimes);
        } catch (error) {
            console.error('Error loading available times:', error);
            this.showError('time-slots', 'Error cargando horarios disponibles.');
        }
    }

    renderAvailableTimes(times) {
        const container = document.getElementById('time-slots');
        
        if (times.length === 0) {
            container.innerHTML = `
                <div class="no-times">
                    <i class="fas fa-calendar-times"></i>
                    <p>No hay horarios disponibles para esta fecha</p>
                    <p>Por favor, selecciona otra fecha</p>
                </div>
            `;
            return;
        }

        container.innerHTML = times.map(time => `
            <div class="time-slot" data-time="${time}" onclick="selectTime('${time}')">
                ${time}
            </div>
        `).join('');
    }

    selectTime(time) {
        // Remove previous selection
        document.querySelectorAll('.time-slot').forEach(slot => {
            slot.classList.remove('selected');
        });

        // Add selection
        event.target.classList.add('selected');
        this.selectedTime = time;
        this.updateNavigation();
    }

    handleClientFormSubmit() {
        const formData = new FormData(document.getElementById('client-form'));
        
        this.clientData = {
            name: formData.get('name'),
            phone: formData.get('phone'),
            email: formData.get('email'),
            notes: formData.get('notes'),
            acceptTerms: document.getElementById('accept-terms').checked,
            acceptWhatsApp: document.getElementById('accept-whatsapp').checked
        };

        if (this.validateClientData()) {
            this.updateBookingSummary();
            this.nextStep();
        }
    }

    validateClientData() {
        const errors = [];
        
        if (!this.clientData.name || this.clientData.name.trim().length < 2) {
            errors.push('El nombre debe tener al menos 2 caracteres');
        }
        
        if (!this.clientData.phone || !this.isValidPhone(this.clientData.phone)) {
            errors.push('El teléfono no es válido');
        }
        
        if (this.clientData.email && !this.isValidEmail(this.clientData.email)) {
            errors.push('El email no es válido');
        }
        
        if (!this.clientData.acceptTerms) {
            errors.push('Debes aceptar los términos y condiciones');
        }

        if (errors.length > 0) {
            this.showValidationErrors(errors);
            return false;
        }

        return true;
    }

    updateBookingSummary() {
        document.getElementById('summary-service').textContent = 
            `${this.selectedService.name} - ${this.selectedService.description}`;
        document.getElementById('summary-date').textContent = 
            this.selectedDate.toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        document.getElementById('summary-time').textContent = this.selectedTime;
        document.getElementById('summary-price').textContent = this.selectedService.price;
        document.getElementById('summary-duration').textContent = this.selectedService.duration;
        
        document.getElementById('summary-client-name').textContent = this.clientData.name;
        document.getElementById('summary-client-phone').textContent = this.clientData.phone;
        
        if (this.clientData.email) {
            document.getElementById('summary-client-email').textContent = this.clientData.email;
            document.getElementById('summary-client-email-row').style.display = 'block';
        }
    }

    async confirmBooking() {
        try {
            this.showLoadingOverlay('Procesando tu reserva...');
            
            const bookingData = {
                service_id: this.selectedService.id,
                appointment_date: this.selectedDate.toISOString().split('T')[0],
                appointment_time: this.selectedTime,
                client_data: this.clientData,
                source: 'widget'
            };

            const response = await fetch(`${this.apiBaseUrl}/bookings/widget`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bookingData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Error creating booking');
            }

            const result = await response.json();
            this.hideLoadingOverlay();
            
            // Show success step
            document.getElementById('booking-id').textContent = result.data.id;
            this.nextStep();
            
        } catch (error) {
            this.hideLoadingOverlay();
            console.error('Error confirming booking:', error);
            this.showError('step-confirmation', 'Error al confirmar la reserva. Por favor, inténtalo de nuevo.');
        }
    }

    nextStep() {
        if (this.currentStep < this.totalSteps) {
            // Special handling for confirmation step
            if (this.currentStep === 4) {
                this.confirmBooking();
                return;
            }
            
            this.currentStep++;
            this.showStep(this.currentStep);
            this.updateNavigation();
        }
    }

    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.showStep(this.currentStep);
            this.updateNavigation();
        }
    }

    showStep(stepNumber) {
        // Hide all steps
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('active');
        });

        // Show current step
        document.getElementById(`step-${this.getStepName(stepNumber)}`).classList.add('active');

        // Update indicators
        document.querySelectorAll('.indicator').forEach((indicator, index) => {
            indicator.classList.remove('active', 'completed');
            if (index + 1 === stepNumber) {
                indicator.classList.add('active');
            } else if (index + 1 < stepNumber) {
                indicator.classList.add('completed');
            }
        });
    }

    getStepName(stepNumber) {
        const stepNames = ['', 'service', 'date', 'time', 'client', 'confirmation', 'success'];
        return stepNames[stepNumber];
    }

    updateNavigation() {
        const backBtn = document.getElementById('back-btn');
        const nextBtn = document.getElementById('next-btn');

        // Show/hide back button
        if (this.currentStep > 1 && this.currentStep < 6) {
            backBtn.style.display = 'flex';
        } else {
            backBtn.style.display = 'none';
        }

        // Update next button
        if (this.currentStep === 6) {
            nextBtn.style.display = 'none';
        } else {
            nextBtn.style.display = 'flex';
            
            // Update button text and state
            switch (this.currentStep) {
                case 1:
                    nextBtn.textContent = 'Siguiente';
                    nextBtn.disabled = !this.selectedService;
                    break;
                case 2:
                    nextBtn.textContent = 'Siguiente';
                    nextBtn.disabled = !this.selectedDate;
                    break;
                case 3:
                    nextBtn.textContent = 'Siguiente';
                    nextBtn.disabled = !this.selectedTime;
                    break;
                case 4:
                    nextBtn.textContent = 'Continuar';
                    nextBtn.disabled = false;
                    break;
                case 5:
                    nextBtn.innerHTML = '<i class="fas fa-check"></i> Confirmar Reserva';
                    nextBtn.disabled = false;
                    break;
            }
        }
    }

    previousMonth() {
        this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
        this.generateCalendar();
    }

    nextMonth() {
        this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
        this.generateCalendar();
    }

    formatPhoneNumber(event) {
        let value = event.target.value.replace(/\D/g, '');
        
        if (value.startsWith('34')) {
            value = '+' + value;
        } else if (value.length === 9) {
            value = '+34' + value;
        } else if (!value.startsWith('+')) {
            value = '+' + value;
        }
        
        event.target.value = value;
    }

    isValidPhone(phone) {
        const phoneRegex = /^\+?[1-9]\d{8,14}$/;
        return phoneRegex.test(phone.replace(/\s/g, ''));
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validateField(field) {
        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';

        switch (field.type) {
            case 'text':
                if (field.required && value.length < 2) {
                    isValid = false;
                    errorMessage = 'Este campo debe tener al menos 2 caracteres';
                }
                break;
            case 'tel':
                if (field.required && !this.isValidPhone(value)) {
                    isValid = false;
                    errorMessage = 'Introduce un número de teléfono válido';
                }
                break;
            case 'email':
                if (value && !this.isValidEmail(value)) {
                    isValid = false;
                    errorMessage = 'Introduce un email válido';
                }
                break;
        }

        this.showFieldValidation(field, isValid, errorMessage);
        return isValid;
    }

    showFieldValidation(field, isValid, errorMessage) {
        // Remove existing error
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }

        if (!isValid) {
            field.style.borderColor = 'var(--danger-color)';
            
            const errorElement = document.createElement('div');
            errorElement.className = 'field-error';
            errorElement.style.color = 'var(--danger-color)';
            errorElement.style.fontSize = '12px';
            errorElement.style.marginTop = '4px';
            errorElement.textContent = errorMessage;
            
            field.parentNode.appendChild(errorElement);
        } else {
            field.style.borderColor = 'var(--success-color)';
        }
    }

    clearFieldError(field) {
        field.style.borderColor = '';
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
    }

    showValidationErrors(errors) {
        const errorContainer = document.createElement('div');
        errorContainer.className = 'validation-errors';
        errorContainer.style.cssText = `
            background: #f8d7da;
            color: #721c24;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 16px;
            border: 1px solid #f5c6cb;
        `;
        
        errorContainer.innerHTML = `
            <strong>Por favor, corrige los siguientes errores:</strong>
            <ul style="margin: 8px 0 0 20px;">
                ${errors.map(error => `<li>${error}</li>`).join('')}
            </ul>
        `;

        const form = document.getElementById('client-form');
        const existingErrors = form.querySelector('.validation-errors');
        if (existingErrors) {
            existingErrors.remove();
        }
        
        form.insertBefore(errorContainer, form.firstChild);
        
        // Scroll to errors
        errorContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    showLoading(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Cargando...</p>
            </div>
        `;
    }

    showError(containerId, message) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="error-message" style="text-align: center; padding: 40px 20px; color: var(--danger-color);">
                <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 16px;"></i>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 16px;">
                    Reintentar
                </button>
            </div>
        `;
    }

    showLoadingOverlay(message = 'Cargando...') {
        const overlay = document.getElementById('loading-overlay');
        overlay.querySelector('p').textContent = message;
        overlay.style.display = 'flex';
    }

    hideLoadingOverlay() {
        document.getElementById('loading-overlay').style.display = 'none';
    }

    addToCalendar() {
        const startDate = new Date(this.selectedDate);
        const [hours, minutes] = this.selectedTime.split(':');
        startDate.setHours(parseInt(hours), parseInt(minutes));
        
        const endDate = new Date(startDate);
        const duration = parseInt(this.selectedService.duration);
        endDate.setMinutes(endDate.getMinutes() + duration);

        const event = {
            title: `${this.selectedService.name} - Ricardo Buriticá Beauty`,
            start: startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z',
            end: endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z',
            description: `Servicio: ${this.selectedService.name}\\nDuración: ${this.selectedService.duration}\\nPrecio: ${this.selectedService.price}`,
            location: 'Ricardo Buriticá Beauty Studio'
        };

        const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${event.start}/${event.end}&details=${encodeURIComponent(event.description)}&location=${encodeURIComponent(event.location)}`;
        
        window.open(googleUrl, '_blank');
    }

    shareBooking() {
        const shareData = {
            title: 'Mi cita en Ricardo Buriticá Beauty',
            text: `He reservado una cita para ${this.selectedService.name} el ${this.selectedDate.toLocaleDateString('es-ES')} a las ${this.selectedTime}`,
            url: window.location.href
        };

        if (navigator.share) {
            navigator.share(shareData);
        } else {
            // Fallback to copy to clipboard
            navigator.clipboard.writeText(`${shareData.text} - ${shareData.url}`).then(() => {
                alert('Información de la reserva copiada al portapapeles');
            });
        }
    }
}

// Global functions for onclick handlers
function selectService(serviceId) {
    window.bookingWidget.selectService(serviceId);
}

function selectTime(time) {
    window.bookingWidget.selectTime(time);
}

function previousMonth() {
    window.bookingWidget.previousMonth();
}

function nextMonth() {
    window.bookingWidget.nextMonth();
}

function previousStep() {
    window.bookingWidget.previousStep();
}

function nextStep() {
    window.bookingWidget.nextStep();
}

function closeWidget() {
    if (window.parent !== window) {
        // If in iframe, send message to parent
        window.parent.postMessage({ type: 'closeBookingWidget' }, '*');
    } else {
        // If standalone, close window or redirect
        window.close();
    }
}

function showTerms() {
    alert('Términos y condiciones: Al reservar una cita, aceptas nuestras políticas de cancelación y privacidad. Las cancelaciones deben realizarse con al menos 24 horas de antelación.');
}

// Initialize widget when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.bookingWidget = new BookingWidget();
});

// Handle iframe communication
window.addEventListener('message', (event) => {
    if (event.data.type === 'configureWidget') {
        if (event.data.apiUrl) {
            window.bookingWidget.apiBaseUrl = event.data.apiUrl;
        }
    }
});