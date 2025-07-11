// src/api/routes/clientRoutes.js
const express = require("express");
const ClientController = require("../controllers/clientController");
const {
  authenticate,
  requireRole,
  requireOwnership,
  userRateLimit,
} = require("../../middleware/authMiddleware");

const router = express.Router();
const clientController = new ClientController();

/**
 * Rutas para clientes autenticados
 */

/**
 * @route GET /api/clients/me
 * @desc Obtener perfil del cliente autenticado
 * @access Private (Client)
 */
router.get(
  "/me",
  authenticate,
  requireRole("client"),
  clientController.getMyProfile.bind(clientController),
);

/**
 * @route PUT /api/clients/me
 * @desc Actualizar perfil del cliente autenticado
 * @access Private (Client)
 */
router.put(
  "/me",
  authenticate,
  requireRole("client"),
  userRateLimit(10, 60 * 60 * 1000), // 10 actualizaciones por hora
  clientController.updateMyProfile.bind(clientController),
);

/**
 * @route GET /api/clients/me/bookings
 * @desc Obtener historial de reservas del cliente
 * @access Private (Client)
 */
router.get(
  "/me/bookings",
  authenticate,
  requireRole("client"),
  clientController.getMyBookings.bind(clientController),
);

/**
 * @route GET /api/clients/me/stats
 * @desc Obtener estadísticas del cliente
 * @access Private (Client)
 */
router.get(
  "/me/stats",
  authenticate,
  requireRole("client"),
  clientController.getMyStats.bind(clientController),
);

/**
 * Rutas para administradores
 */

/**
 * @route GET /api/clients
 * @desc Obtener todos los clientes (con filtros)
 * @access Private (Admin, Manager)
 */
router.get(
  "/",
  authenticate,
  requireRole(["admin", "manager"]),
  clientController.getAllClients.bind(clientController),
);

/**
 * @route GET /api/clients/:id
 * @desc Obtener cliente específico por ID
 * @access Private (Admin, Manager)
 */
router.get(
  "/:id",
  authenticate,
  requireRole(["admin", "manager"]),
  clientController.getClientById.bind(clientController),
);

/**
 * @route PUT /api/clients/:id
 * @desc Actualizar cliente específico
 * @access Private (Admin, Manager)
 */
router.put(
  "/:id",
  authenticate,
  requireRole(["admin", "manager"]),
  userRateLimit(20, 60 * 60 * 1000), // 20 actualizaciones por hora
  clientController.updateClient.bind(clientController),
);

/**
 * @route POST /api/clients/:id/suspend
 * @desc Suspender cliente
 * @access Private (Admin)
 */
router.post(
  "/:id/suspend",
  authenticate,
  requireRole("admin"),
  userRateLimit(5, 60 * 60 * 1000), // 5 suspensiones por hora
  clientController.suspendClient.bind(clientController),
);

/**
 * @route POST /api/clients/:id/reactivate
 * @desc Reactivar cliente suspendido
 * @access Private (Admin)
 */
router.post(
  "/:id/reactivate",
  authenticate,
  requireRole("admin"),
  userRateLimit(5, 60 * 60 * 1000), // 5 reactivaciones por hora
  clientController.reactivateClient.bind(clientController),
);

/**
 * @route DELETE /api/clients/:id
 * @desc Eliminar cliente (acción irreversible)
 * @access Private (Super Admin)
 */
router.delete(
  "/:id",
  authenticate,
  requireRole("super_admin"),
  userRateLimit(2, 24 * 60 * 60 * 1000), // 2 eliminaciones por día
  clientController.deleteClient.bind(clientController),
);

module.exports = router;
