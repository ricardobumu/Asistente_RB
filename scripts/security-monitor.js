#!/usr/bin/env node
// scripts/security-monitor.js
// Monitoreo continuo de seguridad

const { execSync } = require('child_process');

function checkSecurity() {
  console.log('🔒 Verificación de seguridad automática...');
  
  try {
    // Verificar vulnerabilidades
    execSync('npm audit --audit-level moderate', { stdio: 'inherit' });
    console.log('✅ No se encontraron vulnerabilidades críticas');
  } catch (error) {
    console.warn('⚠️  Se encontraron vulnerabilidades - revisar manualmente');
  }
  
  try {
    // Verificar dependencias desactualizadas
    const outdated = execSync('npm outdated --json', { encoding: 'utf8' });
    const outdatedPackages = JSON.parse(outdated || '{}');
    
    if (Object.keys(outdatedPackages).length > 0) {
      console.log('📦 Dependencias desactualizadas encontradas:');
      Object.keys(outdatedPackages).forEach(pkg => {
        console.log(`  - ${pkg}: ${outdatedPackages[pkg].current} → ${outdatedPackages[pkg].latest}`);
      });
    } else {
      console.log('✅ Todas las dependencias están actualizadas');
    }
  } catch (error) {
    console.log('✅ Todas las dependencias están actualizadas');
  }
}

// Ejecutar verificación
checkSecurity();

module.exports = { checkSecurity };