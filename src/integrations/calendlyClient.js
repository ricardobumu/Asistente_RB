// src/integrations/calendlyClient.js
const { CALENDLY_ACCESS_TOKEN } = require("../config/env");

const calendlyClient = {
  accessToken: CALENDLY_ACCESS_TOKEN,
  baseURL: "https://api.calendly.com",

  // Función básica para futuras llamadas a la API
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    };

    return fetch(url, {
      ...options,
      headers,
    });
  },
};

module.exports = calendlyClient;
