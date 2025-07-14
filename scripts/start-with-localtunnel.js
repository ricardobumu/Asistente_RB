#!/usr/bin/env node
// scripts/start-with-localtunnel.js
// Iniciar servidor con localtunnel

const { spawn } = require('child_process');

console.log('🚀 Iniciando servidor con localtunnel...');

// Iniciar el servidor
const server = spawn('npm', ['run', 'start'], {
  stdio: 'inherit',
  shell: true
});

// Esperar un poco para que el servidor inicie
setTimeout(() => {
  console.log('🚇 Iniciando localtunnel...');
  
  // Iniciar localtunnel
  const lt = spawn('lt', ['--port', '3000'], {
    stdio: 'inherit',
    shell: true
  });
  
  lt.on('error', (error) => {
    console.log('❌ Error iniciando localtunnel:', error.message);
    console.log('💡 Instala localtunnel: npm install -g localtunnel');
  });
  
}, 3000);

// Manejar cierre
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor y túnel...');
  server.kill();
  process.exit();
});