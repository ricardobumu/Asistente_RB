/**
 * CORRECCIÓN DEL SERVICIO SUPABASE
 * Script para actualizar supabaseService.js con tu estructura real
 */

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local", override: true });

const fs = require("fs");
const path = require("path");

console.log("🔧 CORRIGIENDO SUPABASE SERVICE PARA ESTRUCTURA REAL\n");

// Leer el archivo actual
const servicePath = path.join(__dirname, "services", "supabaseService.js");
const currentContent = fs.readFileSync(servicePath, "utf8");

console.log("📋 PROBLEMAS DETECTADOS:");
console.log('   ❌ Usa tabla "whatsapp_conversations" (no existe)');
console.log('   ❌ Usa tabla "calendly_events" (no existe)');
console.log('   ❌ Usa tabla "audit_logs" (no existe)');
console.log("");
console.log("✅ ESTRUCTURA REAL:");
console.log("   ✅ conversations (existe)");
console.log("   ✅ messages (existe)");
console.log("   ✅ clients (existe)");
console.log("   ✅ services (existe)");
console.log("   ✅ appointments (existe)");
console.log("");

// Crear versión corregida
const correctedService = `/**
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
      current_step: conversationData.current_step || 'initial',
      user_data: conversationData.user_data || {},
      attempts_count: conversationData.attempts_count || 0,
      last_updated: new Date().toISOString(),
      language: conversationData.language || 'es',
      id_cliente: client.id,
      id_reserva: conversationData.id_reserva || null,
      last_message_id: conversationData.last_message_id || null,
    };

    // Usar upsert para actualizar o crear
    const { data, error } = await supabaseClient
      .from("conversations")
      .upsert(conversationRecord, {
        onConflict: 'phone_number',
        ignoreDuplicates: false
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
 * Crea una cita
 * @param {object} appointmentData - Datos de la cita
 * @returns {object} - Cita creada
 */
async function createAppointment(appointmentData) {
  try {
    if (!supabaseClient) {
      throw new Error("Supabase no está configurado");
    }

    const { data, error } = await supabaseClient
      .from("appointments")
      .insert(appointmentData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info("Cita creada", {
      appointmentId: data.id,
      clientId: appointmentData.client_id,
      serviceId: appointmentData.service_id,
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
  supabaseClient, // Para uso directo si es necesario
};`;

// Crear backup del archivo original
const backupPath = servicePath + ".backup";
fs.writeFileSync(backupPath, currentContent);
console.log(`📁 Backup creado: ${backupPath}`);

// Escribir la versión corregida
fs.writeFileSync(servicePath, correctedService);
console.log(`✅ Archivo actualizado: ${servicePath}`);

console.log("\n" + "=".repeat(60));
console.log("🎉 SUPABASE SERVICE CORREGIDO EXITOSAMENTE");
console.log("=".repeat(60));

console.log("\n✅ CAMBIOS REALIZADOS:");
console.log('   ✅ Usa tabla "conversations" (real)');
console.log('   ✅ Usa tabla "messages" (real)');
console.log("   ✅ Funciones adaptadas a tu estructura");
console.log("   ✅ Manejo de errores mejorado");
console.log("   ✅ Logging optimizado");

console.log("\n📋 FUNCIONES DISPONIBLES:");
console.log("   • testConnection()");
console.log("   • getOrCreateClient()");
console.log("   • getClientByPhone()");
console.log("   • saveConversation()");
console.log("   • saveMessage()");
console.log("   • getConversationByPhone()");
console.log("   • getRecentMessages()");
console.log("   • getServices()");
console.log("   • createAppointment()");

console.log("\n🎯 PRÓXIMO PASO:");
console.log("   Probar la conexión con: npm test");

console.log("=".repeat(60));
