#!/usr/bin/env node
// scripts/start-with-ngrok.js
// Iniciar servidor con túnel ngrok

const { spawn } = require('child_process');

console.log('🚀 Iniciando servidor con túnel ngrok...');

// Iniciar el servidor
const server = spawn('npm', ['run', 'start'], {
  stdio: 'inherit',
  shell: true
});

// Esperar un poco para que el servidor inicie
setTimeout(() => {
  console.log('🚇 Iniciando túnel ngrok...');
  
  // Iniciar ngrok
  const ngrok = spawn('ngrok', ['http', '3000'], {
    stdio: 'inherit',
    shell: true
  });
  
  ngrok.on('error', (error) => {
    console.log('❌ Error iniciando ngrok:', error.message);
    console.log('💡 Instala ngrok: npm install -g ngrok');
  });
  
}, 3000);

// Manejar cierre
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor y túnel...');
  server.kill();
  process.exit();
});