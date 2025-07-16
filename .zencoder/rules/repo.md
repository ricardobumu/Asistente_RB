# Asistente RB Information

## Summary

Asistente RB is a comprehensive booking management system with automated notifications, integrating with Supabase, Twilio, Calendly, and OpenAI. It provides client management, booking scheduling, automated notifications via WhatsApp/Email/SMS, and an AI-powered conversational assistant.

## Structure

- **src/**: Core application code
  - **api/**: API endpoints and controllers
  - **config/**: Environment and application configuration
  - **controllers/**: Request handlers
  - **integrations/**: External service clients
  - **middleware/**: Express middleware
  - **models/**: Data models
  - **routes/**: Route definitions
  - **services/**: Business logic
  - **utils/**: Utility functions
- **scripts/**: Database and setup scripts
- **public/**: Static files for admin dashboard
- **docs/**: API and model documentation

## Language & Runtime

**Language**: JavaScript (Node.js)
**Version**: Node.js 18+
**Build System**: npm
**Package Manager**: npm

## Dependencies

**Main Dependencies**:

- **Express**: Web framework (v4.18.0)
- **Supabase**: Database and authentication (v2.50.3)
- **Twilio**: Messaging and notifications (v5.7.2)
- **OpenAI**: AI integration (v5.8.2)
- **JWT**: Authentication (jsonwebtoken v9.0.2)
- **Winston**: Logging (v3.11.0)
- **Joi**: Data validation (v17.13.3)

**Development Dependencies**:

- **Nodemon**: Development server (v3.1.10)

## Deployment

**Platform**: Railway
**Project ID**: 2806399e-7537-46ce-acc7-fa043193e2a9
**Project Name**: Asistente RB
**Public URL**: bot.ricardoburitica.eu
**Webhook URL**: https://bot.ricardoburitica.eu/webhook/whatsapp

## Environment Configuration

The application uses multiple environment files:

- **.env**: Base configuration
- **.env.local**: Local secrets and overrides (contains Railway Access Token)
- **railway.toml**: Railway-specific configuration

## Build & Installation

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your credentials

# Setup application
npm run setup

# Development mode
npm run dev

# Production mode
npm start
```

## Testing

**Framework**: No formal testing framework implemented
**Test Location**: src/tests/ (empty directory)
**Run Command**:

```bash
# No tests implemented yet
npm test
```

## Project Structure

The repository contains two projects:

1. **Main Project**: Full-featured booking system with AI integration
2. **Asistente_RB Subdirectory**: Minimal Express application (appears to be a prototype or starter)

### Main Project Components

- **Booking System**: Client and service management
- **Notification System**: WhatsApp, Email, and SMS notifications
- **Admin Dashboard**: Management interface in public/admin/
- **Autonomous Assistant**: AI-powered conversational assistant
- **Security Layer**: Comprehensive security middleware

### Secondary Project

The nested Asistente_RB directory contains a minimal Express application with basic dependencies (Express, dotenv, nodemon) that appears to be an earlier prototype or starter template.
