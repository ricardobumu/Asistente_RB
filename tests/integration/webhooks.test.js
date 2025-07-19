/**
 * TESTS DE INTEGRACIÓN - WEBHOOKS
 * Pruebas end-to-end para los webhooks de WhatsApp y Calendly
 */

const request = require("supertest");
const app = require("../../app");

describe("Webhooks Integration Tests", () => {
  beforeAll(() => {
    mockConsole();
  });

  afterAll(() => {
    restoreConsole();
  });

  describe("WhatsApp Webhook Integration", () => {
    test("debería procesar webhook completo de WhatsApp", async () => {
      const webhookData = {
        From: "whatsapp:+34600000001",
        To: "whatsapp:+14155238886",
        Body: "Hola, quiero hacer una reserva",
        MessageSid: "test_integration_message_id",
        MessageType: "text",
      };

      const response = await request(app)
        .post("/webhook/whatsapp")
        .send(webhookData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.message_processed).toBe(true);
    }, 30000);

    test("debería manejar webhook con media", async () => {
      const webhookWithMedia = {
        From: "whatsapp:+34600000002",
        To: "whatsapp:+14155238886",
        Body: "Aquí tienes una imagen",
        MessageSid: "test_media_message_id",
        MessageType: "image",
        NumMedia: "1",
        MediaUrl0: "https://example.com/image.jpg",
        MediaContentType0: "image/jpeg",
        MediaSize0: "12345",
      };

      const response = await request(app)
        .post("/webhook/whatsapp")
        .send(webhookWithMedia)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.has_media).toBe(true);
    }, 30000);

    test("debería manejar webhook con ubicación", async () => {
      const webhookWithLocation = {
        From: "whatsapp:+34600000003",
        To: "whatsapp:+14155238886",
        Body: "Mi ubicación actual",
        MessageSid: "test_location_message_id",
        MessageType: "text",
        Latitude: "40.4168",
        Longitude: "-3.7038",
        Address: "Madrid, España",
      };

      const response = await request(app)
        .post("/webhook/whatsapp")
        .send(webhookWithLocation)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.has_location).toBe(true);
    }, 30000);
  });

  describe("Calendly Webhook Integration", () => {
    test("debería procesar webhook completo de Calendly", async () => {
      const calendlyWebhook = {
        event: "invitee.created",
        payload: {
          event: {
            uri: "https://api.calendly.com/scheduled_events/integration_test_event",
            name: "Consulta de Integración",
            start_time: new Date(Date.now() + 86400000).toISOString(), // Mañana
            end_time: new Date(Date.now() + 90000000).toISOString(), // Mañana + 1h
          },
          invitee: {
            uri: "https://api.calendly.com/scheduled_events/integration_test_event/invitees/test_invitee",
            name: "Usuario de Integración",
            email: "integration@test.com",
            questions_and_answers: [
              {
                question: "Número de teléfono",
                answer: "+34600000004",
              },
              {
                question: "¿En qué podemos ayudarte?",
                answer: "Necesito información sobre sus servicios",
              },
            ],
          },
        },
        created_at: new Date().toISOString(),
      };

      const response = await request(app)
        .post("/api/calendly/webhook")
        .send(calendlyWebhook)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.event_processed).toBe(true);
      expect(response.body.data.phone_notification_sent).toBe(true);
    }, 30000);

    test("debería procesar cancelación de evento", async () => {
      const cancelWebhook = {
        event: "invitee.canceled",
        payload: {
          event: {
            uri: "https://api.calendly.com/scheduled_events/cancel_test_event",
            name: "Consulta Cancelada",
            start_time: new Date(Date.now() + 86400000).toISOString(),
            end_time: new Date(Date.now() + 90000000).toISOString(),
          },
          invitee: {
            uri: "https://api.calendly.com/scheduled_events/cancel_test_event/invitees/cancel_invitee",
            name: "Usuario Cancelación",
            email: "cancel@test.com",
            questions_and_answers: [
              {
                question: "Número de teléfono",
                answer: "+34600000005",
              },
            ],
          },
        },
        created_at: new Date().toISOString(),
      };

      const response = await request(app)
        .post("/api/calendly/webhook")
        .send(cancelWebhook)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.event_type).toBe("invitee.canceled");
    }, 30000);
  });

  describe("Health Checks", () => {
    test("debería responder health check de WhatsApp", async () => {
      const response = await request(app)
        .get("/webhook/whatsapp/health")
        .expect(200);

      expect(response.body.service).toBe("WhatsApp Webhooks");
      expect(response.body.status).toBe("healthy");
    });

    test("debería responder health check de Calendly", async () => {
      const response = await request(app)
        .get("/api/calendly/health")
        .expect(200);

      expect(response.body.service).toBe("Calendly Webhooks");
      expect(response.body.status).toBe("healthy");
    });

    test("debería responder status de WhatsApp", async () => {
      const response = await request(app)
        .get("/webhook/whatsapp/status")
        .expect(200);

      expect(response.body.service).toBe("WhatsApp Integration");
      expect(response.body.status).toBe("operational");
      expect(response.body.configuration).toBeDefined();
    });

    test("debería responder status de Calendly", async () => {
      const response = await request(app)
        .get("/api/calendly/status")
        .expect(200);

      expect(response.body.service).toBe("Calendly Integration");
      expect(response.body.status).toBe("operational");
      expect(response.body.configuration).toBeDefined();
    });
  });
});
