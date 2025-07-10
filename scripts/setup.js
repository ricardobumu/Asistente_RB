#!/usr/bin/env node

// scripts/setup.js - Script de configuración inicial del proyecto

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("🚀 Configuración inicial de Asistente RB\n");

const questions = [
  {
    key: "SUPABASE_URL",
    question: "📊 URL de Supabase (requerido): ",
    required: true,
  },
  {
    key: "SUPABASE_ANON_KEY",
    question: "🔑 Clave anónima de Supabase (requerido): ",
    required: true,
  },
  {
    key: "TWILIO_ACCOUNT_SID",
    question: "📱 Twilio Account SID (opcional): ",
    required: false,
  },
  {
    key: "TWILIO_AUTH_TOKEN",
    question: "🔐 Twilio Auth Token (opcional): ",
    required: false,
  },
  {
    key: "OPENAI_API_KEY",
    question: "🤖 API Key de OpenAI (opcional): ",
    required: false,
  },
];

const answers = {};

async function askQuestion(index = 0) {
  if (index >= questions.length) {
    await createEnvFile();
    return;
  }

  const { key, question, required } = questions[index];

  rl.question(question, (answer) => {
    if (required && !answer.trim()) {
      console.log("❌ Este campo es requerido. Por favor, ingrésalo.");
      askQuestion(index);
      return;
    }

    answers[key] = answer.trim();
    askQuestion(index + 1);
  });
}

async function createEnvFile() {
  try {
    // Leer el archivo .env.example
    const examplePath = path.join(__dirname, "..", ".env.example");
    const envPath = path.join(__dirname, "..", ".env");

    let envContent = fs.readFileSync(examplePath, "utf8");

    // Reemplazar valores
    Object.entries(answers).forEach(([key, value]) => {
      if (value) {
        const regex = new RegExp(`${key}=.*`, "g");
        envContent = envContent.replace(regex, `${key}=${value}`);
      }
    });

    // Escribir archivo .env
    fs.writeFileSync(envPath, envContent);

    console.log("\n✅ Archivo .env creado exitosamente!");
    console.log("\n📋 Próximos pasos:");
    console.log("1. Ejecuta: npm install");
    console.log("2. Ejecuta: npm run dev");
    console.log("3. Visita: http://localhost:3000");

    rl.close();
  } catch (error) {
    console.error("❌ Error creando archivo .env:", error.message);
    rl.close();
  }
}

// Verificar si ya existe .env
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  rl.question(
    "⚠️  Ya existe un archivo .env. ¿Deseas sobrescribirlo? (y/N): ",
    (answer) => {
      if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
        askQuestion();
      } else {
        console.log("❌ Configuración cancelada.");
        rl.close();
      }
    }
  );
} else {
  askQuestion();
}
