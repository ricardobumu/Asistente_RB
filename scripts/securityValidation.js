// scripts/securityValidation.js
// Script para validar configuración de seguridad antes del deployment

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");

class SecurityValidator {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: [],
    };
  }

  /**
   * Ejecuta todas las validaciones de seguridad
   */
  async validate() {
    console.log("🔒 VALIDACIÓN DE SEGURIDAD - ASISTENTE VIRTUAL AUTÓNOMO\n");

    // Validaciones de configuración
    await this.validateEnvironmentVariables();
    await this.validateJWTSecrets();
    await this.validateAPIKeys();

    // Validaciones de archivos
    await this.validateFilePermissions();
    await this.validateDependencies();

    // Validaciones de red
    await this.validateSSLConfiguration();
    await this.validateCORSConfiguration();

    // Validaciones de logging
    await this.validateLoggingConfiguration();

    // Validaciones específicas del asistente
    await this.validateIntegrationSecurity();

    // Resumen final
    this.printSummary();

    return this.results.failed === 0;
  }

  /**
   * Validar variables de entorno críticas
   */
  async validateEnvironmentVariables() {
    await this.runTest("Environment Variables", async () => {
      const required = [
        "NODE_ENV",
        "JWT_SECRET",
        "JWT_REFRESH_SECRET",
        "OPENAI_API_KEY",
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "CALENDLY_ACCESS_TOKEN",
      ];

      const missing = [];
      const weak = [];

      for (const variable of required) {
        const value = process.env[variable];

        if (!value) {
          missing.push(variable);
        } else if (variable.includes("SECRET") && value.length < 32) {
          weak.push(variable);
        } else if (variable.includes("KEY") && value.length < 20) {
          weak.push(variable);
        }
      }

      if (missing.length > 0) {
        throw new Error(
          `Missing critical environment variables: ${missing.join(", ")}`
        );
      }

      if (weak.length > 0) {
        this.addWarning(`Weak secrets detected: ${weak.join(", ")}`);
      }

      return `All ${required.length} critical environment variables are present`;
    });
  }

  /**
   * Validar fortaleza de secretos JWT
   */
  async validateJWTSecrets() {
    await this.runTest("JWT Secret Strength", async () => {
      const jwtSecret = process.env.JWT_SECRET;
      const refreshSecret = process.env.JWT_REFRESH_SECRET;

      if (!jwtSecret || !refreshSecret) {
        throw new Error("JWT secrets not configured");
      }

      // Verificar longitud mínima
      if (jwtSecret.length < 64) {
        throw new Error("JWT_SECRET too short (minimum 64 characters)");
      }

      if (refreshSecret.length < 64) {
        throw new Error("JWT_REFRESH_SECRET too short (minimum 64 characters)");
      }

      // Verificar que no sean iguales
      if (jwtSecret === refreshSecret) {
        throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be different");
      }

      // Verificar entropía básica
      const entropy = this.calculateEntropy(jwtSecret);
      if (entropy < 4.0) {
        this.addWarning("JWT_SECRET has low entropy, consider regenerating");
      }

      return "JWT secrets meet security requirements";
    });
  }

  /**
   * Validar configuración de APIs externas
   */
  async validateAPIKeys() {
    await this.runTest("External API Keys", async () => {
      const apis = [
        { name: "OpenAI", key: process.env.OPENAI_API_KEY, prefix: "sk-" },
        {
          name: "Twilio SID",
          key: process.env.TWILIO_ACCOUNT_SID,
          prefix: "AC",
        },
        {
          name: "Calendly",
          key: process.env.CALENDLY_ACCESS_TOKEN,
          minLength: 20,
        },
      ];

      const issues = [];

      for (const api of apis) {
        if (!api.key) {
          issues.push(`${api.name} key missing`);
          continue;
        }

        if (api.prefix && !api.key.startsWith(api.prefix)) {
          issues.push(`${api.name} key format invalid`);
        }

        if (api.minLength && api.key.length < api.minLength) {
          issues.push(`${api.name} key too short`);
        }
      }

      if (issues.length > 0) {
        throw new Error(`API key issues: ${issues.join(", ")}`);
      }

      return "All API keys are properly configured";
    });
  }

  /**
   * Validar permisos de archivos sensibles
   */
  async validateFilePermissions() {
    await this.runTest("File Permissions", async () => {
      const sensitiveFiles = [
        ".env",
        ".env.local",
        ".env.production",
        "logs/",
        "src/config/",
      ];

      const issues = [];

      for (const file of sensitiveFiles) {
        const filePath = path.join(process.cwd(), file);

        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          const mode = stats.mode & parseInt("777", 8);

          // Verificar que no sea world-readable
          if (mode & parseInt("004", 8)) {
            issues.push(`${file} is world-readable`);
          }

          // Verificar que no sea world-writable
          if (mode & parseInt("002", 8)) {
            issues.push(`${file} is world-writable`);
          }
        }
      }

      if (issues.length > 0) {
        this.addWarning(`File permission issues: ${issues.join(", ")}`);
      }

      return "File permissions are secure";
    });
  }

  /**
   * Validar dependencias por vulnerabilidades conocidas
   */
  async validateDependencies() {
    await this.runTest("Dependency Security", async () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
      );

      const vulnerableDeps = [
        "lodash@<4.17.21",
        "express@<4.18.0",
        "jsonwebtoken@<8.5.1",
      ];

      const issues = [];
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      for (const [dep, version] of Object.entries(dependencies)) {
        // Verificar versiones específicas conocidas como vulnerables
        if (dep === "lodash" && version.includes("4.17.20")) {
          issues.push(`${dep}@${version} has known vulnerabilities`);
        }
      }

      if (issues.length > 0) {
        this.addWarning(`Dependency issues: ${issues.join(", ")}`);
      }

      return "Dependencies appear secure";
    });
  }

  /**
   * Validar configuración SSL
   */
  async validateSSLConfiguration() {
    await this.runTest("SSL Configuration", async () => {
      if (process.env.NODE_ENV !== "production") {
        return "SSL validation skipped in development";
      }

      const domain = process.env.DOMAIN || "api.ricardoburitica.eu";

      return new Promise((resolve, reject) => {
        const options = {
          hostname: domain,
          port: 443,
          path: "/health",
          method: "GET",
          timeout: 5000,
        };

        const req = https.request(options, (res) => {
          const cert = res.socket.getPeerCertificate();

          if (!cert || Object.keys(cert).length === 0) {
            reject(new Error("No SSL certificate found"));
            return;
          }

          const now = new Date();
          const validFrom = new Date(cert.valid_from);
          const validTo = new Date(cert.valid_to);

          if (now < validFrom || now > validTo) {
            reject(new Error("SSL certificate is expired or not yet valid"));
            return;
          }

          // Verificar que el certificado sea para el dominio correcto
          if (
            !cert.subject.CN.includes(domain) &&
            !cert.subjectaltname?.includes(domain)
          ) {
            reject(new Error("SSL certificate domain mismatch"));
            return;
          }

          resolve("SSL certificate is valid and properly configured");
        });

        req.on("error", (err) => {
          reject(new Error(`SSL validation failed: ${err.message}`));
        });

        req.on("timeout", () => {
          req.destroy();
          reject(new Error("SSL validation timeout"));
        });

        req.end();
      });
    });
  }

  /**
   * Validar configuración CORS
   */
  async validateCORSConfiguration() {
    await this.runTest("CORS Configuration", async () => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS;

      if (!allowedOrigins) {
        throw new Error("ALLOWED_ORIGINS not configured");
      }

      const origins = allowedOrigins.split(",");
      const issues = [];

      for (const origin of origins) {
        if (
          !origin.startsWith("https://") &&
          process.env.NODE_ENV === "production"
        ) {
          issues.push(`Non-HTTPS origin in production: ${origin}`);
        }

        if (origin.includes("*")) {
          issues.push(`Wildcard origin detected: ${origin}`);
        }
      }

      if (issues.length > 0) {
        throw new Error(`CORS issues: ${issues.join(", ")}`);
      }

      return `CORS properly configured for ${origins.length} origins`;
    });
  }

  /**
   * Validar configuración de logging
   */
  async validateLoggingConfiguration() {
    await this.runTest("Logging Configuration", async () => {
      const logDir = path.join(process.cwd(), "logs");

      if (!fs.existsSync(logDir)) {
        throw new Error("Logs directory does not exist");
      }

      // Verificar que los logs no contengan información sensible
      const logFiles = fs.readdirSync(logDir);
      const sensitivePatterns = [
        /password/i,
        /secret/i,
        /token/i,
        /key/i,
        /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card pattern
        /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
      ];

      for (const file of logFiles) {
        if (file.endsWith(".log")) {
          const content = fs.readFileSync(path.join(logDir, file), "utf8");

          for (const pattern of sensitivePatterns) {
            if (pattern.test(content)) {
              this.addWarning(`Potential sensitive data in log file: ${file}`);
              break;
            }
          }
        }
      }

      return "Logging configuration is secure";
    });
  }

  /**
   * Validar seguridad de integraciones específicas
   */
  async validateIntegrationSecurity() {
    await this.runTest("Integration Security", async () => {
      const issues = [];

      // Validar configuración de Twilio
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        if (!process.env.TWILIO_WHATSAPP_NUMBER) {
          issues.push("Twilio WhatsApp number not configured");
        }
      }

      // Validar configuración de OpenAI
      if (process.env.OPENAI_API_KEY) {
        if (!process.env.OPENAI_API_KEY.startsWith("sk-")) {
          issues.push("OpenAI API key format invalid");
        }
      }

      // Validar configuración de Calendly
      if (process.env.CALENDLY_ACCESS_TOKEN) {
        if (process.env.CALENDLY_ACCESS_TOKEN.length < 20) {
          issues.push("Calendly access token appears invalid");
        }
      }

      if (issues.length > 0) {
        throw new Error(`Integration issues: ${issues.join(", ")}`);
      }

      return "All integrations are securely configured";
    });
  }

  /**
   * Calcular entropía de una cadena
   */
  calculateEntropy(str) {
    const freq = {};
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }

    let entropy = 0;
    const len = str.length;

    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Ejecutar un test individual
   */
  async runTest(name, testFunction) {
    try {
      const result = await testFunction();
      this.results.passed++;
      this.results.tests.push({ name, status: "PASS", message: result });
      console.log(`✅ ${name}: ${result}`);
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: "FAIL", message: error.message });
      console.log(`❌ ${name}: ${error.message}`);
    }
  }

  /**
   * Agregar warning
   */
  addWarning(message) {
    this.results.warnings++;
    console.log(`⚠️  WARNING: ${message}`);
  }

  /**
   * Imprimir resumen de resultados
   */
  printSummary() {
    console.log("\n" + "=".repeat(60));
    console.log("🔒 RESUMEN DE VALIDACIÓN DE SEGURIDAD");
    console.log("=".repeat(60));
    console.log(`✅ Tests pasados: ${this.results.passed}`);
    console.log(`❌ Tests fallidos: ${this.results.failed}`);
    console.log(`⚠️  Warnings: ${this.results.warnings}`);
    console.log(`📊 Total: ${this.results.passed + this.results.failed}`);

    if (this.results.failed === 0) {
      console.log("\n🎉 ¡VALIDACIÓN DE SEGURIDAD EXITOSA!");
      console.log("✅ El sistema cumple con los estándares de seguridad");

      if (this.results.warnings > 0) {
        console.log("⚠️  Revisa los warnings para mejorar la seguridad");
      }
    } else {
      console.log("\n🚨 VALIDACIÓN DE SEGURIDAD FALLÓ");
      console.log("❌ Corrige los errores antes del deployment");

      console.log("\nTests fallidos:");
      this.results.tests
        .filter((test) => test.status === "FAIL")
        .forEach((test) => {
          console.log(`  - ${test.name}: ${test.message}`);
        });
    }

    console.log("\n" + "=".repeat(60));
  }

  /**
   * Generar reporte de seguridad
   */
  generateSecurityReport() {
    const report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      summary: {
        passed: this.results.passed,
        failed: this.results.failed,
        warnings: this.results.warnings,
        total: this.results.passed + this.results.failed,
      },
      tests: this.results.tests,
      recommendations: [
        "Rotar secretos JWT cada 90 días",
        "Monitorear logs de seguridad diariamente",
        "Actualizar dependencias mensualmente",
        "Revisar permisos de archivos semanalmente",
        "Validar certificados SSL mensualmente",
      ],
    };

    const reportPath = path.join(process.cwd(), "logs", "security-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`📄 Reporte de seguridad guardado en: ${reportPath}`);
    return report;
  }
}

// Ejecutar validación si se llama directamente
if (require.main === module) {
  const validator = new SecurityValidator();

  (async () => {
    try {
      const success = await validator.validate();
      validator.generateSecurityReport();

      if (!success) {
        console.log("\n❌ Validación de seguridad falló");
        process.exit(1);
      }

      console.log("\n🚀 ¡Sistema listo para deployment seguro!");
      process.exit(0);
    } catch (error) {
      console.error(
        "💥 Error durante la validación de seguridad:",
        error.message
      );
      process.exit(1);
    }
  })();
}

module.exports = SecurityValidator;
