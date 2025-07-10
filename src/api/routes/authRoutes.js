// src/api/routes/authRoutes.js
const express = require("express");
const AuthController = require("../controllers/authController");
const {
  authenticate,
  requireRole,
} = require("../../middleware/authMiddleware");
const AuditMiddleware = require("../../middleware/auditMiddleware");

const router = express.Router();
const authController = new AuthController();

/**
 * Rutas de autenticación con rate limiting específico
 */

// Rate limiting más estricto para rutas de autenticación
const authRateLimit = AuditMiddleware.rateLimitMiddleware(5, 15 * 60 * 1000); // 5 intentos por 15 minutos
const registerRateLimit = AuditMiddleware.rateLimitMiddleware(
  3,
  60 * 60 * 1000
); // 3 registros por hora

/**
 * @route POST /api/auth/login/client
 * @desc Login de cliente
 * @access Public
 */
router.post(
  "/login/client",
  authRateLimit,
  authController.loginClient.bind(authController)
);

/**
 * @route POST /api/auth/register/client
 * @desc Registro de cliente
 * @access Public
 */
router.post(
  "/register/client",
  registerRateLimit,
  authController.registerClient.bind(authController)
);

/**
 * @route POST /api/auth/refresh
 * @desc Renovar access token usando refresh token
 * @access Public
 */
router.post(
  "/refresh",
  authRateLimit,
  authController.refreshToken.bind(authController)
);

/**
 * @route POST /api/auth/logout
 * @desc Logout (invalidar tokens)
 * @access Private
 */
router.post(
  "/logout",
  authenticate,
  authController.logout.bind(authController)
);

/**
 * @route GET /api/auth/me
 * @desc Obtener información del usuario autenticado
 * @access Private
 */
router.get("/me", authenticate, authController.me.bind(authController));

/**
 * @route POST /api/auth/login/staff
 * @desc Login de staff/admin (implementar después)
 * @access Public
 */
router.post("/login/staff", authRateLimit, (req, res) => {
  res.status(501).json({
    success: false,
    error: "Funcionalidad en desarrollo",
  });
});

/**
 * @route POST /api/auth/forgot-password
 * @desc Solicitar reset de contraseña (implementar después)
 * @access Public
 */
router.post("/forgot-password", authRateLimit, (req, res) => {
  res.status(501).json({
    success: false,
    error: "Funcionalidad en desarrollo",
  });
});

/**
 * @route POST /api/auth/reset-password
 * @desc Reset de contraseña con token (implementar después)
 * @access Public
 */
router.post("/reset-password", authRateLimit, (req, res) => {
  res.status(501).json({
    success: false,
    error: "Funcionalidad en desarrollo",
  });
});

/**
 * @route POST /api/auth/change-password
 * @desc Cambiar contraseña (usuario autenticado)
 * @access Private
 */
router.post("/change-password", authenticate, (req, res) => {
  res.status(501).json({
    success: false,
    error: "Funcionalidad en desarrollo",
  });
});

/**
 * @route GET /api/auth/sessions
 * @desc Listar sesiones activas del usuario
 * @access Private
 */
router.get("/sessions", authenticate, (req, res) => {
  res.status(501).json({
    success: false,
    error: "Funcionalidad en desarrollo",
  });
});

/**
 * @route DELETE /api/auth/sessions/:sessionId
 * @desc Cerrar sesión específica
 * @access Private
 */
router.delete("/sessions/:sessionId", authenticate, (req, res) => {
  res.status(501).json({
    success: false,
    error: "Funcionalidad en desarrollo",
  });
});

module.exports = router;
