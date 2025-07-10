// src/middleware/protectionMiddleware.js
// Middleware de protección avanzada contra ataques

const crypto = require("crypto");
const logger = require("../utils/logger");
const DatabaseAdapter = require("../adapters/databaseAdapter");

class ProtectionMiddleware {
  // Cache para tracking de IPs sospechosas
  static suspiciousIPs = new Map();
  static blockedIPs = new Set();
  static rateLimitCache = new Map();

  /**
   * Protección contra ataques de fuerza bruta
   */
  static bruteForcePrevention(options = {}) {
    const {
      maxAttempts = 5,
      windowMs = 15 * 60 * 1000, // 15 minutos
      blockDurationMs = 60 * 60 * 1000, // 1 hora
      endpoints = ["/login", "/admin", "/auth"],
    } = options;

    return (req, res, next) => {
      try {
        const ip = req.ip;
        const endpoint = req.originalUrl;

        // Solo aplicar a endpoints sensibles
        if (!endpoints.some((ep) => endpoint.includes(ep))) {
          return next();
        }

        const key = `${ip}:${endpoint}`;
        const now = Date.now();

        // Verificar si la IP está bloqueada
        if (this.blockedIPs.has(ip)) {
          logger.warn("Blocked IP attempted access", {
            ip,
            endpoint,
            userAgent: req.headers["user-agent"],
          });

          return res.status(429).json({
            success: false,
            error: "IP temporarily blocked due to suspicious activity",
            retryAfter: Math.ceil(blockDurationMs / 1000),
          });
        }

        // Obtener o crear registro de intentos
        let attempts = this.rateLimitCache.get(key) || {
          count: 0,
          firstAttempt: now,
          lastAttempt: now,
        };

        // Resetear si ha pasado la ventana de tiempo
        if (now - attempts.firstAttempt > windowMs) {
          attempts = {
            count: 1,
            firstAttempt: now,
            lastAttempt: now,
          };
        } else {
          attempts.count++;
          attempts.lastAttempt = now;
        }

        this.rateLimitCache.set(key, attempts);

        // Verificar si se excedió el límite
        if (attempts.count > maxAttempts) {
          // Bloquear IP
          this.blockedIPs.add(ip);

          // Programar desbloqueo
          setTimeout(() => {
            this.blockedIPs.delete(ip);
            this.rateLimitCache.delete(key);
          }, blockDurationMs);

          logger.error("IP blocked for brute force attempts", {
            ip,
            endpoint,
            attempts: attempts.count,
            userAgent: req.headers["user-agent"],
          });

          return res.status(429).json({
            success: false,
            error: "Too many failed attempts. IP blocked temporarily.",
            retryAfter: Math.ceil(blockDurationMs / 1000),
          });
        }

        // Agregar información de rate limiting a la request
        req.rateLimitInfo = {
          attempts: attempts.count,
          remaining: maxAttempts - attempts.count,
          resetTime: attempts.firstAttempt + windowMs,
        };

        next();
      } catch (error) {
        logger.error("Brute force prevention error", {
          error: error.message,
          ip: req.ip,
        });
        next();
      }
    };
  }

  /**
   * Detección de patrones de ataque
   */
  static attackPatternDetection(req, res, next) {
    try {
      const ip = req.ip;
      const userAgent = req.headers["user-agent"] || "";
      const url = req.originalUrl;
      const method = req.method;

      // Patrones sospechosos en URL
      const suspiciousPatterns = [
        /\.\./, // Directory traversal
        /\/etc\/passwd/, // System file access
        /\/proc\//, // Process information
        /\bselect\b.*\bfrom\b/i, // SQL injection
        /\bunion\b.*\bselect\b/i, // SQL injection
        /\bdrop\b.*\btable\b/i, // SQL injection
        /<script/i, // XSS
        /javascript:/i, // XSS
        /on\w+\s*=/i, // Event handlers
        /\bexec\b/i, // Command injection
        /\beval\b/i, // Code injection
        /\bsystem\b/i, // System commands
        /\bcmd\b/i, // Command execution
        /\bwget\b/i, // File download
        /\bcurl\b/i, // HTTP requests
        /\bnc\b/i, // Netcat
        /\btelnet\b/i, // Telnet
        /\bssh\b/i, // SSH
        /\bftp\b/i, // FTP
        /\bphpmyadmin\b/i, // Database admin
        /\badmin\b/i, // Admin access
        /\bwp-admin\b/i, // WordPress admin
        /\bconfig\b/i, // Configuration files
        /\bbackup\b/i, // Backup files
        /\bdump\b/i, // Database dumps
        /\btest\b/i, // Test files
        /\bdebug\b/i, // Debug information
        /\berror\b/i, // Error information
        /\binfo\b/i, // Information disclosure
        /\bstatus\b/i, // Status information
        /\bhealth\b/i, // Health checks
        /\bmetrics\b/i, // Metrics
        /\bapi\/v\d+/i, // API versioning
        /\bgraphql\b/i, // GraphQL
        /\brest\b/i, // REST API
        /\bsoap\b/i, // SOAP API
        /\bxml\b/i, // XML
        /\bjson\b/i, // JSON
        /\byaml\b/i, // YAML
        /\btoml\b/i, // TOML
        /\bini\b/i, // INI files
        /\bconf\b/i, // Configuration
        /\benv\b/i, // Environment variables
        /\bdotenv\b/i, // .env files
        /\bgit\b/i, // Git repository
        /\bsvn\b/i, // SVN repository
        /\bhg\b/i, // Mercurial repository
        /\bbzr\b/i, // Bazaar repository
        /\bcvs\b/i, // CVS repository
        /\bnode_modules\b/i, // Node.js modules
        /\bpackage\.json\b/i, // Package configuration
        /\bcomposer\.json\b/i, // Composer configuration
        /\brequirements\.txt\b/i, // Python requirements
        /\bGemfile\b/i, // Ruby gems
        /\bMakefile\b/i, // Make configuration
        /\bDockerfile\b/i, // Docker configuration
        /\bdocker-compose\b/i, // Docker Compose
        /\bkubernetes\b/i, // Kubernetes
        /\bhelm\b/i, // Helm charts
        /\bterraform\b/i, // Terraform
        /\bansible\b/i, // Ansible
        /\bchef\b/i, // Chef
        /\bpuppet\b/i, // Puppet
        /\bsalt\b/i, // SaltStack
        /\bvagrant\b/i, // Vagrant
        /\baws\b/i, // AWS
        /\bazure\b/i, // Azure
        /\bgcp\b/i, // Google Cloud Platform
        /\bheroku\b/i, // Heroku
        /\bvercel\b/i, // Vercel
        /\bnetlify\b/i, // Netlify
        /\brailway\b/i, // Railway
        /\brender\b/i, // Render
        /\bdigitalocean\b/i, // DigitalOcean
        /\blinode\b/i, // Linode
        /\bvultr\b/i, // Vultr
        /\bhetzner\b/i, // Hetzner
        /\bovh\b/i, // OVH
        /\bcloudflare\b/i, // Cloudflare
        /\bfastly\b/i, // Fastly
        /\bcdn\b/i, // CDN
        /\bs3\b/i, // S3 bucket
        /\brds\b/i, // RDS database
        /\bec2\b/i, // EC2 instance
        /\blambda\b/i, // Lambda function
        /\bapi-gateway\b/i, // API Gateway
        /\bcloudfront\b/i, // CloudFront
        /\broute53\b/i, // Route 53
        /\biam\b/i, // IAM
        /\bsts\b/i, // STS
        /\bkms\b/i, // KMS
        /\bsecrets-manager\b/i, // Secrets Manager
        /\bparameter-store\b/i, // Parameter Store
        /\bcloudwatch\b/i, // CloudWatch
        /\bx-ray\b/i, // X-Ray
        /\bcloudtrail\b/i, // CloudTrail
        /\bconfig\b/i, // Config
        /\binspector\b/i, // Inspector
        /\bguardduty\b/i, // GuardDuty
        /\bmacie\b/i, // Macie
        /\bsecurity-hub\b/i, // Security Hub
        /\bwaf\b/i, // WAF
        /\bshield\b/i, // Shield
        /\bfirewall\b/i, // Firewall
        /\bvpn\b/i, // VPN
        /\bproxy\b/i, // Proxy
        /\bload-balancer\b/i, // Load Balancer
        /\bauto-scaling\b/i, // Auto Scaling
        /\bcontainer\b/i, // Container
        /\bkubectl\b/i, // Kubectl
        /\bhelm\b/i, // Helm
        /\bistio\b/i, // Istio
        /\blinkerd\b/i, // Linkerd
        /\bconsul\b/i, // Consul
        /\bvault\b/i, // Vault
        /\bnomad\b/i, // Nomad
        /\bpacker\b/i, // Packer
        /\bjenkins\b/i, // Jenkins
        /\bgitlab\b/i, // GitLab
        /\bgithub\b/i, // GitHub
        /\bbitbucket\b/i, // Bitbucket
        /\bazure-devops\b/i, // Azure DevOps
        /\bcircleci\b/i, // CircleCI
        /\btravis\b/i, // Travis CI
        /\bappveyor\b/i, // AppVeyor
        /\bbuildkite\b/i, // Buildkite
        /\bteamcity\b/i, // TeamCity
        /\bbamboo\b/i, // Bamboo
        /\boctopus\b/i, // Octopus Deploy
        /\bspinnaker\b/i, // Spinnaker
        /\bargo\b/i, // Argo
        /\bflux\b/i, // Flux
        /\btekton\b/i, // Tekton
        /\bskaffold\b/i, // Skaffold
        /\bdraft\b/i, // Draft
        /\bhelm\b/i, // Helm
        /\bkustomize\b/i, // Kustomize
        /\bkompose\b/i, // Kompose
        /\bminikube\b/i, // Minikube
        /\bkind\b/i, // Kind
        /\bk3s\b/i, // K3s
        /\bmicrok8s\b/i, // MicroK8s
        /\bopenshift\b/i, // OpenShift
        /\brancher\b/i, // Rancher
        /\btanzu\b/i, // Tanzu
        /\beks\b/i, // EKS
        /\baks\b/i, // AKS
        /\bgke\b/i, // GKE
        /\bdigitalocean-k8s\b/i, // DigitalOcean Kubernetes
        /\blinode-k8s\b/i, // Linode Kubernetes
        /\bvultr-k8s\b/i, // Vultr Kubernetes
        /\bhetzner-k8s\b/i, // Hetzner Kubernetes
        /\bovh-k8s\b/i, // OVH Kubernetes
        /\bscaleway-k8s\b/i, // Scaleway Kubernetes
        /\bupcloud-k8s\b/i, // UpCloud Kubernetes
        /\bexoscale-k8s\b/i, // Exoscale Kubernetes
        /\bcivo-k8s\b/i, // Civo Kubernetes
        /\bpacket-k8s\b/i, // Packet Kubernetes
        /\bequinix-k8s\b/i, // Equinix Kubernetes
        /\bibm-k8s\b/i, // IBM Kubernetes
        /\boracle-k8s\b/i, // Oracle Kubernetes
        /\balibaba-k8s\b/i, // Alibaba Kubernetes
        /\btencent-k8s\b/i, // Tencent Kubernetes
        /\bbaidu-k8s\b/i, // Baidu Kubernetes
        /\bhuawei-k8s\b/i, // Huawei Kubernetes
        /\bnaver-k8s\b/i, // Naver Kubernetes
        /\bkakao-k8s\b/i, // Kakao Kubernetes
        /\bline-k8s\b/i, // Line Kubernetes
        /\bsoftbank-k8s\b/i, // SoftBank Kubernetes
        /\bntt-k8s\b/i, // NTT Kubernetes
        /\brakuten-k8s\b/i, // Rakuten Kubernetes
        /\byahoo-k8s\b/i, // Yahoo Kubernetes
        /\bgmo-k8s\b/i, // GMO Kubernetes
        /\bsakura-k8s\b/i, // Sakura Kubernetes
        /\bconoha-k8s\b/i, // ConoHa Kubernetes
        /\bvultr-k8s\b/i, // Vultr Kubernetes
        /\blinode-k8s\b/i, // Linode Kubernetes
        /\bdigitalocean-k8s\b/i, // DigitalOcean Kubernetes
        /\bhetzner-k8s\b/i, // Hetzner Kubernetes
        /\bovh-k8s\b/i, // OVH Kubernetes
        /\bscaleway-k8s\b/i, // Scaleway Kubernetes
        /\bupcloud-k8s\b/i, // UpCloud Kubernetes
        /\bexoscale-k8s\b/i, // Exoscale Kubernetes
        /\bcivo-k8s\b/i, // Civo Kubernetes
        /\bpacket-k8s\b/i, // Packet Kubernetes
        /\bequinix-k8s\b/i, // Equinix Kubernetes
        /\bibm-k8s\b/i, // IBM Kubernetes
        /\boracle-k8s\b/i, // Oracle Kubernetes
        /\balibaba-k8s\b/i, // Alibaba Kubernetes
        /\btencent-k8s\b/i, // Tencent Kubernetes
        /\bbaidu-k8s\b/i, // Baidu Kubernetes
        /\bhuawei-k8s\b/i, // Huawei Kubernetes
        /\bnaver-k8s\b/i, // Naver Kubernetes
        /\bkakao-k8s\b/i, // Kakao Kubernetes
        /\bline-k8s\b/i, // Line Kubernetes
        /\bsoftbank-k8s\b/i, // SoftBank Kubernetes
        /\bntt-k8s\b/i, // NTT Kubernetes
        /\brakuten-k8s\b/i, // Rakuten Kubernetes
        /\byahoo-k8s\b/i, // Yahoo Kubernetes
        /\bgmo-k8s\b/i, // GMO Kubernetes
        /\bsakura-k8s\b/i, // Sakura Kubernetes
        /\bconoha-k8s\b/i, // ConoHa Kubernetes
      ];

      // Verificar patrones sospechosos
      const isSuspicious = suspiciousPatterns.some(
        (pattern) => pattern.test(url) || pattern.test(userAgent)
      );

      if (isSuspicious) {
        // Incrementar contador de actividad sospechosa
        const suspiciousData = this.suspiciousIPs.get(ip) || {
          count: 0,
          firstSeen: Date.now(),
          patterns: [],
        };

        suspiciousData.count++;
        suspiciousData.lastSeen = Date.now();

        // Registrar patrón detectado
        const detectedPattern = suspiciousPatterns.find(
          (pattern) => pattern.test(url) || pattern.test(userAgent)
        );

        if (
          detectedPattern &&
          !suspiciousData.patterns.includes(detectedPattern.source)
        ) {
          suspiciousData.patterns.push(detectedPattern.source);
        }

        this.suspiciousIPs.set(ip, suspiciousData);

        logger.warn("Suspicious activity detected", {
          ip,
          url,
          method,
          userAgent,
          pattern: detectedPattern?.source,
          suspiciousCount: suspiciousData.count,
        });

        // Bloquear IP si hay demasiada actividad sospechosa
        if (suspiciousData.count >= 3) {
          this.blockedIPs.add(ip);

          logger.error("IP blocked for suspicious activity", {
            ip,
            suspiciousCount: suspiciousData.count,
            patterns: suspiciousData.patterns,
          });

          return res.status(403).json({
            success: false,
            error: "Access denied due to suspicious activity",
          });
        }
      }

      next();
    } catch (error) {
      logger.error("Attack pattern detection error", {
        error: error.message,
        ip: req.ip,
      });
      next();
    }
  }

  /**
   * Protección contra ataques de timing
   */
  static timingAttackProtection(req, res, next) {
    // Agregar delay aleatorio para prevenir timing attacks
    const delay = Math.floor(Math.random() * 50) + 10; // 10-60ms

    setTimeout(() => {
      next();
    }, delay);
  }

  /**
   * Validación de integridad de requests
   */
  static requestIntegrityValidation(req, res, next) {
    try {
      // Verificar tamaño de request
      const contentLength = parseInt(req.headers["content-length"] || "0");
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (contentLength > maxSize) {
        logger.warn("Request too large", {
          ip: req.ip,
          contentLength,
          maxSize,
          url: req.originalUrl,
        });

        return res.status(413).json({
          success: false,
          error: "Request entity too large",
        });
      }

      // Verificar headers sospechosos
      const suspiciousHeaders = [
        "x-forwarded-for",
        "x-real-ip",
        "x-originating-ip",
        "x-remote-ip",
        "x-client-ip",
      ];

      let headerWarnings = 0;
      suspiciousHeaders.forEach((header) => {
        if (req.headers[header]) {
          headerWarnings++;
        }
      });

      if (headerWarnings > 2) {
        logger.warn("Multiple proxy headers detected", {
          ip: req.ip,
          headers: suspiciousHeaders.filter((h) => req.headers[h]),
          url: req.originalUrl,
        });
      }

      next();
    } catch (error) {
      logger.error("Request integrity validation error", {
        error: error.message,
        ip: req.ip,
      });
      next();
    }
  }

  /**
   * Protección contra ataques de enumeración
   */
  static enumerationProtection(req, res, next) {
    const ip = req.ip;
    const url = req.originalUrl;

    // Patrones de enumeración
    const enumerationPatterns = [
      /\/api\/users\/\d+$/,
      /\/api\/clients\/\d+$/,
      /\/api\/bookings\/\d+$/,
      /\/api\/services\/\d+$/,
      /\/admin\/users\/\d+$/,
      /\/admin\/reports\/\d+$/,
    ];

    const isEnumeration = enumerationPatterns.some((pattern) =>
      pattern.test(url)
    );

    if (isEnumeration) {
      const key = `enum:${ip}`;
      const attempts = this.rateLimitCache.get(key) || {
        count: 0,
        firstAttempt: Date.now(),
      };

      attempts.count++;
      attempts.lastAttempt = Date.now();

      // Resetear cada hora
      if (Date.now() - attempts.firstAttempt > 60 * 60 * 1000) {
        attempts.count = 1;
        attempts.firstAttempt = Date.now();
      }

      this.rateLimitCache.set(key, attempts);

      // Limitar intentos de enumeración
      if (attempts.count > 20) {
        logger.warn("Enumeration attack detected", {
          ip,
          url,
          attempts: attempts.count,
        });

        return res.status(429).json({
          success: false,
          error: "Too many requests",
        });
      }
    }

    next();
  }

  /**
   * Limpiar caches periódicamente
   */
  static startCleanupTask() {
    setInterval(() => {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 horas

      // Limpiar IPs sospechosas antiguas
      for (const [ip, data] of this.suspiciousIPs.entries()) {
        if (now - data.lastSeen > maxAge) {
          this.suspiciousIPs.delete(ip);
        }
      }

      // Limpiar cache de rate limiting
      for (const [key, data] of this.rateLimitCache.entries()) {
        if (now - data.lastAttempt > maxAge) {
          this.rateLimitCache.delete(key);
        }
      }

      logger.info("Protection middleware cache cleaned", {
        suspiciousIPs: this.suspiciousIPs.size,
        rateLimitEntries: this.rateLimitCache.size,
        blockedIPs: this.blockedIPs.size,
      });
    }, 60 * 60 * 1000); // Cada hora
  }

  /**
   * Obtener estadísticas de protección
   */
  static getProtectionStats() {
    return {
      suspiciousIPs: this.suspiciousIPs.size,
      blockedIPs: this.blockedIPs.size,
      rateLimitEntries: this.rateLimitCache.size,
      topSuspiciousIPs: Array.from(this.suspiciousIPs.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([ip, data]) => ({
          ip,
          count: data.count,
          patterns: data.patterns.length,
        })),
    };
  }
}

// Iniciar tarea de limpieza
ProtectionMiddleware.startCleanupTask();

module.exports = ProtectionMiddleware;
