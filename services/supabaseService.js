/**
 * SERVICIO DE SUPABASE - VERSIÓN CORREGIDA
 * Cliente para interactuar con la base de datos Supabase
 * Actualizado para usar la estructura real de la BD
 *
 * Funcionalidades:
 * - Gestión de clientes
 * - Conversaciones (tabla conversations)
 * - Mensajes (tabla messages)
 * - Servicios y citas
 * - Cumplimiento GDPR
 */

const { createClient } = require("@supabase/supabase-js");
const config = require("../config/environment");
const logger = require("../utils/logger");

// Inicializar cliente de Supabase
let supabaseClient = null;

if (config.SUPABASE_URL && config.SUPABASE_ANON_KEY) {
  supabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
    },
    db: {
      schema: "public",
    },
  });
} else {
  logger.error("Configuración de Supabase incompleta");
}

/**
 * Verifica la conexión con Supabase
 * @returns {boolean} - true si la conexión es exitosa
 */
async function testConnection() {
  try {
    if (!supabaseClient) {
      return false;
    }

    const { data, error } = await supabaseClient
      .from("clients")
      .select("id")
      .limit(1);

    if (error) {
      logger.error("Error probando conexión Supabase", {
        error: error.message,
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Error de conexión Supabase", { error: error.message });
    return false;
  }
}

/**
 * Obtiene o crea un cliente por número de teléfono
 * @param {string} phoneNumber - Número de teléfono
 * @param {object} additionalData - Datos adicionales del cliente
 * @returns {object} - Datos del cliente
 */
async function getOrCreateClient(phoneNumber, additionalData = {}) {
  try {
    if (!supabaseClient) {
      throw new Error("Supabase no está configurado");
    }

    // Buscar cliente existente
    const { data: existingClient, error: searchError } = await supabaseClient
      .from("clients")
      .select("*")
      .eq("phone_number", phoneNumber)
      .single();

    if (searchError && searchError.code !== "PGRST116") {
      // PGRST116 = no rows found
      throw searchError;
    }

    if (existingClient) {
      // Actualizar última actividad si el campo existe
      const updateData = { ...additionalData };
      if (existingClient.last_activity !== undefined) {
        updateData.last_activity = new Date().toISOString();
      }

      const { data: updatedClient, error: updateError } = await supabaseClient
        .from("clients")
        .update(updateData)
        .eq("id", existingClient.id)
        .select()
        .single();

      if (updateError) {
        logger.warn("Error actualizando cliente existente", {
          error: updateError.message,
          phoneNumber,
        });
        return existingClient;
      }

      logger.info("Cliente actualizado", {
        clientId: existingClient.id,
        phoneNumber,
      });

      return updatedClient || existingClient;
    }

    // Crear nuevo cliente
    const newClientData = {
      phone_number: phoneNumber,
      name: additionalData.name || null,
      email: additionalData.email || null,
      created_at: new Date().toISOString(),
      ...additionalData,
    };

    const { data: newClient, error: createError } = await supabaseClient
      .from("clients")
      .insert(newClientData)
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    logger.info("Cliente creado", {
      clientId: newClient.id,
      phoneNumber,
    });

    return newClient;
  } catch (error) {
    logger.error("Error gestionando cliente", {
      error: error.message,
      phoneNumber,
      additionalData,
    });
    throw error;
  }
}

/**
 * Obtiene un cliente por número de teléfono
 * @param {string} phoneNumber - Número de teléfono
 * @returns {object|null} - Datos del cliente o null
 */
async function getClientByPhone(phoneNumber) {
  try {
    if (!supabaseClient) {
      return null;
    }

    const { data, error } = await supabaseClient
      .from("clients")
      .select("*")
      .eq("phone_number", phoneNumber)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return data;
  } catch (error) {
    logger.error("Error obteniendo cliente por teléfono", {
      error: error.message,
      phoneNumber,
    });
    return null;
  }
}

/**
 * Guarda o actualiza una conversación (usando tabla conversations real)
 * @param {string} phoneNumber - Número de teléfono
 * @param {object} conversationData - Datos de la conversación
 * @returns {object} - Conversación guardada
 */
async function saveConversation(phoneNumber, conversationData = {}) {
  try {
    if (!supabaseClient) {
      throw new Error("Supabase no está configurado");
    }

    // Obtener o crear cliente
    const client = await getOrCreateClient(phoneNumber);

    // Preparar datos de la conversación según tu estructura real
    const conversationRecord = {
      phone_number: phoneNumber,
      current_step: conversationData.current_step || "initial",
      user_data: conversationData.user_data || {},
      attempts_count: conversationData.attempts_count || 0,
      last_updated: new Date().toISOString(),
      language: conversationData.language || "es",
      id_cliente: client.id,
      id_reserva: conversationData.id_reserva || null,
      last_message_id: conversationData.last_message_id || null,
    };

    // Usar upsert para actualizar o crear
    const { data, error } = await supabaseClient
      .from("conversations")
      .upsert(conversationRecord, {
        onConflict: "phone_number",
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info("Conversación guardada", {
      phoneNumber,
      currentStep: conversationData.current_step,
      clientId: client.id,
    });

    return data;
  } catch (error) {
    logger.error("Error guardando conversación", {
      error: error.message,
      phoneNumber,
    });
    throw error;
  }
}

/**
 * Guarda un mensaje (usando tabla messages real)
 * @param {string} userId - ID del usuario (phone_number)
 * @param {string} content - Contenido del mensaje
 * @param {boolean} isFromUser - Si el mensaje es del usuario
 * @returns {object} - Mensaje guardado
 */
async function saveMessage(userId, content, isFromUser = true) {
  try {
    if (!supabaseClient) {
      throw new Error("Supabase no está configurado");
    }

    const messageData = {
      user_id: userId,
      content: content,
      is_from_user: isFromUser,
      is_encrypted: false,
      timestamp: new Date().toISOString(),
    };

    const { data, error } = await supabaseClient
      .from("messages")
      .insert(messageData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info("Mensaje guardado", {
      userId,
      isFromUser,
      messageId: data.id,
    });

    return data;
  } catch (error) {
    logger.error("Error guardando mensaje", {
      error: error.message,
      userId,
    });
    throw error;
  }
}

/**
 * Obtiene conversación por teléfono
 * @param {string} phoneNumber - Número de teléfono
 * @returns {object|null} - Conversación o null
 */
async function getConversationByPhone(phoneNumber) {
  try {
    if (!supabaseClient) {
      return null;
    }

    const { data, error } = await supabaseClient
      .from("conversations")
      .select("*")
      .eq("phone_number", phoneNumber)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return data;
  } catch (error) {
    logger.error("Error obteniendo conversación", {
      error: error.message,
      phoneNumber,
    });
    return null;
  }
}

/**
 * Obtiene mensajes recientes de un usuario
 * @param {string} userId - ID del usuario
 * @param {number} limit - Límite de mensajes
 * @returns {array} - Array de mensajes
 */
async function getRecentMessages(userId, limit = 10) {
  try {
    if (!supabaseClient) {
      return [];
    }

    const { data, error } = await supabaseClient
      .from("messages")
      .select("*")
      .eq("user_id", userId)
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    logger.error("Error obteniendo mensajes recientes", {
      error: error.message,
      userId,
    });
    return [];
  }
}

/**
 * Obtiene servicios disponibles
 * @returns {array} - Array de servicios
 */
async function getServices() {
  try {
    if (!supabaseClient) {
      return [];
    }

    const { data, error } = await supabaseClient
      .from("services")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    logger.error("Error obteniendo servicios", {
      error: error.message,
    });
    return [];
  }
}

/**
 * Crea una cita (usando estructura real de appointments)
 * @param {object} appointmentData - Datos de la cita
 * @returns {object} - Cita creada
 */
async function createAppointment(appointmentData) {
  try {
    if (!supabaseClient) {
      throw new Error("Supabase no está configurado");
    }

    // Mapear datos a la estructura real de appointments
    const appointmentRecord = {
      client_id: appointmentData.client_id,
      service_id: appointmentData.service_id,
      scheduled_at:
        appointmentData.scheduled_at || appointmentData.appointment_date,
      status: appointmentData.status || "scheduled",
      calendly_event_uri: appointmentData.calendly_event_uri || null,
      notes: appointmentData.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseClient
      .from("appointments")
      .insert(appointmentRecord)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info("Cita creada", {
      appointmentId: data.id,
      clientId: data.client_id,
      serviceId: data.service_id,
      scheduledAt: data.scheduled_at,
    });

    return data;
  } catch (error) {
    logger.error("Error creando cita", {
      error: error.message,
      appointmentData,
    });
    throw error;
  }
}

/**
 * Obtiene citas de un cliente
 * @param {string} clientId - ID del cliente
 * @returns {array} - Array de citas
 */
async function getClientAppointments(clientId) {
  try {
    if (!supabaseClient) {
      return [];
    }

    const { data, error } = await supabaseClient
      .from("appointments")
      .select(
        `
        *,
        services (
          id,
          name,
          description,
          price,
          duration,
          category
        )
      `
      )
      .eq("client_id", clientId)
      .order("scheduled_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    logger.error("Error obteniendo citas del cliente", {
      error: error.message,
      clientId,
    });
    return [];
  }
}

/**
 * Actualiza una cita
 * @param {string} appointmentId - ID de la cita
 * @param {object} updateData - Datos a actualizar
 * @returns {object} - Cita actualizada
 */
async function updateAppointment(appointmentId, updateData) {
  try {
    if (!supabaseClient) {
      throw new Error("Supabase no está configurado");
    }

    const updateRecord = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseClient
      .from("appointments")
      .update(updateRecord)
      .eq("id", appointmentId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info("Cita actualizada", {
      appointmentId: data.id,
      status: data.status,
    });

    return data;
  } catch (error) {
    logger.error("Error actualizando cita", {
      error: error.message,
      appointmentId,
      updateData,
    });
    throw error;
  }
}

/**
 * Registra un error en la tabla errors
 * @param {string} sessionId - ID de la sesión
 * @param {string} errorCode - Código del error
 * @param {string} errorMessage - Mensaje del error
 * @param {object} metadata - Metadatos adicionales
 * @returns {object} - Error registrado
 */
async function logError(sessionId, errorCode, errorMessage, metadata = {}) {
  try {
    if (!supabaseClient) {
      return null;
    }

    const errorRecord = {
      session_id: sessionId,
      error_code: errorCode,
      error_message: errorMessage,
      metadata: metadata,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseClient
      .from("errors")
      .insert(errorRecord)
      .select()
      .single();

    if (error) {
      // No lanzar error aquí para evitar bucles infinitos
      logger.warn("Error registrando error en BD", {
        error: error.message,
        sessionId,
        errorCode,
      });
      return null;
    }

    return data;
  } catch (error) {
    logger.warn("Error registrando error", {
      error: error.message,
      sessionId,
      errorCode,
    });
    return null;
  }
}

// Exportar funciones
module.exports = {
  testConnection,
  getOrCreateClient,
  getClientByPhone,
  saveConversation,
  saveMessage,
  getConversationByPhone,
  getRecentMessages,
  getServices,
  createAppointment,
  getClientAppointments,
  updateAppointment,
  logError,
  supabaseClient, // Para uso directo si es necesario
};
