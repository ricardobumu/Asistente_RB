// scripts/performanceCheck.js
// Script para verificar el rendimiento del sistema

const axios = require('axios');
const { performance } = require('perf_hooks');

class PerformanceChecker {
  constructor() {
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    this.results = {
      endpoints: [],
      summary: {},
      recommendations: []
    };
  }

  async checkEndpoint(endpoint, method = 'GET', data = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const iterations = 5;
    const times = [];

    console.log(`\n🔍 Testing ${method} ${endpoint}...`);

    for (let i = 0; i < iterations; i++) {
      try {
        const start = performance.now();
        
        let response;
        if (method === 'GET') {
          response = await axios.get(url, { timeout: 10000 });
        } else if (method === 'POST') {
          response = await axios.post(url, data, { timeout: 10000 });
        }
        
        const end = performance.now();
        const responseTime = end - start;
        times.push(responseTime);

        console.log(`  Iteration ${i + 1}: ${responseTime.toFixed(2)}ms (${response.status})`);

      } catch (error) {
        console.log(`  Iteration ${i + 1}: ERROR - ${error.message}`);
        times.push(null);
      }
    }

    // Calcular estadísticas
    const validTimes = times.filter(t => t !== null);
    const stats = {
      endpoint,
      method,
      iterations: validTimes.length,
      successRate: (validTimes.length / iterations * 100).toFixed(2) + '%',
      avgTime: validTimes.length > 0 ? (validTimes.reduce((a, b) => a + b) / validTimes.length).toFixed(2) : 'N/A',
      minTime: validTimes.length > 0 ? Math.min(...validTimes).toFixed(2) : 'N/A',
      maxTime: validTimes.length > 0 ? Math.max(...validTimes).toFixed(2) : 'N/A'
    };

    this.results.endpoints.push(stats);
    return stats;
  }

  async checkHealth() {
    console.log('🏥 Checking system health...');
    
    try {
      const response = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
      console.log('✅ Health check passed');
      console.log(`   Status: ${response.data.status}`);
      console.log(`   Uptime: ${response.data.uptime}s`);
      console.log(`   Environment: ${response.data.environment}`);
      
      if (response.data.alerts && response.data.alerts.length > 0) {
        console.log('⚠️  Active alerts:');
        response.data.alerts.forEach(alert => {
          console.log(`   - ${alert.severity.toUpperCase()}: ${alert.message}`);
        });
      }

      return response.data;
    } catch (error) {
      console.log('❌ Health check failed:', error.message);
      return null;
    }
  }

  async checkMetrics() {
    console.log('\n📊 Checking system metrics...');
    
    try {
      const response = await axios.get(`${this.baseUrl}/metrics?summary=true`, { timeout: 5000 });
      const metrics = response.data.data;
      
      console.log('✅ Metrics retrieved successfully');
      console.log(`   Total Requests: ${metrics.performance.totalRequests}`);
      console.log(`   Success Rate: ${metrics.performance.successRate}`);
      console.log(`   Avg Response Time: ${metrics.performance.averageResponseTime}`);
      console.log(`   Memory Usage: ${metrics.system.memoryUsage}`);
      console.log(`   WhatsApp Messages: ${metrics.whatsapp.messagesProcessed}`);
      console.log(`   Total Bookings: ${metrics.bookings.total}`);

      return metrics;
    } catch (error) {
      console.log('❌ Metrics check failed:', error.message);
      return null;
    }
  }

  async checkCacheStats() {
    console.log('\n💾 Checking cache performance...');
    
    try {
      const response = await axios.get(`${this.baseUrl}/cache/stats`, { timeout: 5000 });
      const stats = response.data.data;
      
      console.log('✅ Cache stats retrieved');
      console.log(`   Hit Rate: ${stats.hitRate}`);
      console.log(`   Cache Size: ${stats.size}/${stats.maxSize}`);
      console.log(`   Memory Usage: ${stats.memoryUsage.formatted}`);
      console.log(`   Total Hits: ${stats.hits}`);
      console.log(`   Total Misses: ${stats.misses}`);

      return stats;
    } catch (error) {
      console.log('❌ Cache stats check failed:', error.message);
      return null;
    }
  }

  async runFullCheck() {
    console.log('🚀 Starting Performance Check...');
    console.log('=====================================');

    // 1. Health Check
    const health = await this.checkHealth();

    // 2. Metrics Check
    const metrics = await this.checkMetrics();

    // 3. Cache Stats
    const cacheStats = await this.checkCacheStats();

    // 4. Endpoint Performance Tests
    console.log('\n🎯 Testing endpoint performance...');
    
    const endpointsToTest = [
      { endpoint: '/health', method: 'GET' },
      { endpoint: '/widget/info', method: 'GET' },
      { endpoint: '/widget/services', method: 'GET' },
      { endpoint: '/metrics?summary=true', method: 'GET' }
    ];

    for (const test of endpointsToTest) {
      await this.checkEndpoint(test.endpoint, test.method, test.data);
    }

    // 5. Generate Summary
    this.generateSummary(health, metrics, cacheStats);

    // 6. Generate Recommendations
    this.generateRecommendations();

    // 7. Display Results
    this.displayResults();
  }

  generateSummary(health, metrics, cacheStats) {
    const validEndpoints = this.results.endpoints.filter(e => e.avgTime !== 'N/A');
    const avgResponseTime = validEndpoints.length > 0 ? 
      (validEndpoints.reduce((sum, e) => sum + parseFloat(e.avgTime), 0) / validEndpoints.length).toFixed(2) : 'N/A';

    this.results.summary = {
      overallHealth: health ? 'Healthy' : 'Unhealthy',
      totalEndpointsTested: this.results.endpoints.length,
      successfulEndpoints: validEndpoints.length,
      averageResponseTime: avgResponseTime + 'ms',
      cacheHitRate: cacheStats ? cacheStats.hitRate : 'N/A',
      systemUptime: health ? health.uptime + 's' : 'N/A',
      activeAlerts: health && health.alerts ? health.alerts.length : 0
    };
  }

  generateRecommendations() {
    const recommendations = [];

    // Analizar tiempos de respuesta
    this.results.endpoints.forEach(endpoint => {
      if (endpoint.avgTime !== 'N/A') {
        const avgTime = parseFloat(endpoint.avgTime);
        
        if (avgTime > 2000) {
          recommendations.push({
            type: 'performance',
            severity: 'high',
            message: `${endpoint.endpoint} is slow (${endpoint.avgTime}ms). Consider optimization.`
          });
        } else if (avgTime > 1000) {
          recommendations.push({
            type: 'performance',
            severity: 'medium',
            message: `${endpoint.endpoint} could be faster (${endpoint.avgTime}ms).`
          });
        }
      }

      if (parseFloat(endpoint.successRate) < 100) {
        recommendations.push({
          type: 'reliability',
          severity: 'high',
          message: `${endpoint.endpoint} has reliability issues (${endpoint.successRate} success rate).`
        });
      }
    });

    // Recomendaciones generales
    if (this.results.summary.averageResponseTime !== 'N/A' && 
        parseFloat(this.results.summary.averageResponseTime) > 1000) {
      recommendations.push({
        type: 'general',
        severity: 'medium',
        message: 'Overall response times are high. Consider implementing more caching.'
      });
    }

    if (this.results.summary.activeAlerts > 0) {
      recommendations.push({
        type: 'monitoring',
        severity: 'high',
        message: `There are ${this.results.summary.activeAlerts} active alerts that need attention.`
      });
    }

    this.results.recommendations = recommendations;
  }

  displayResults() {
    console.log('\n📋 PERFORMANCE CHECK RESULTS');
    console.log('=====================================');

    // Summary
    console.log('\n📊 SUMMARY:');
    Object.entries(this.results.summary).forEach(([key, value]) => {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      console.log(`   ${label}: ${value}`);
    });

    // Endpoint Details
    console.log('\n🎯 ENDPOINT PERFORMANCE:');
    this.results.endpoints.forEach(endpoint => {
      console.log(`\n   ${endpoint.method} ${endpoint.endpoint}:`);
      console.log(`     Success Rate: ${endpoint.successRate}`);
      console.log(`     Avg Time: ${endpoint.avgTime}ms`);
      console.log(`     Min Time: ${endpoint.minTime}ms`);
      console.log(`     Max Time: ${endpoint.maxTime}ms`);
    });

    // Recommendations
    if (this.results.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      this.results.recommendations.forEach((rec, index) => {
        const icon = rec.severity === 'high' ? '🔴' : rec.severity === 'medium' ? '🟡' : '🟢';
        console.log(`   ${index + 1}. ${icon} [${rec.type.toUpperCase()}] ${rec.message}`);
      });
    } else {
      console.log('\n✅ No recommendations - system is performing well!');
    }

    console.log('\n=====================================');
    console.log('Performance check completed! 🎉');
  }

  async loadTest(endpoint, concurrent = 10, duration = 30) {
    console.log(`\n🔥 Load testing ${endpoint} with ${concurrent} concurrent users for ${duration}s...`);
    
    const url = `${this.baseUrl}${endpoint}`;
    const startTime = Date.now();
    const endTime = startTime + (duration * 1000);
    const results = [];
    let totalRequests = 0;
    let successfulRequests = 0;

    const makeRequest = async () => {
      while (Date.now() < endTime) {
        try {
          const requestStart = performance.now();
          const response = await axios.get(url, { timeout: 10000 });
          const requestEnd = performance.now();
          
          totalRequests++;
          if (response.status >= 200 && response.status < 400) {
            successfulRequests++;
          }
          
          results.push(requestEnd - requestStart);
        } catch (error) {
          totalRequests++;
        }
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    };

    // Start concurrent requests
    const promises = Array(concurrent).fill().map(() => makeRequest());
    await Promise.all(promises);

    // Calculate results
    const avgResponseTime = results.length > 0 ? 
      (results.reduce((a, b) => a + b) / results.length).toFixed(2) : 'N/A';
    const requestsPerSecond = (totalRequests / duration).toFixed(2);
    const successRate = totalRequests > 0 ? 
      (successfulRequests / totalRequests * 100).toFixed(2) : '0';

    console.log(`\n📈 Load Test Results for ${endpoint}:`);
    console.log(`   Total Requests: ${totalRequests}`);
    console.log(`   Successful Requests: ${successfulRequests}`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log(`   Requests/Second: ${requestsPerSecond}`);
    console.log(`   Average Response Time: ${avgResponseTime}ms`);
    console.log(`   Min Response Time: ${Math.min(...results).toFixed(2)}ms`);
    console.log(`   Max Response Time: ${Math.max(...results).toFixed(2)}ms`);

    return {
      endpoint,
      totalRequests,
      successfulRequests,
      successRate: parseFloat(successRate),
      requestsPerSecond: parseFloat(requestsPerSecond),
      avgResponseTime: parseFloat(avgResponseTime)
    };
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const checker = new PerformanceChecker();
  
  const command = process.argv[2];
  
  if (command === 'load') {
    const endpoint = process.argv[3] || '/health';
    const concurrent = parseInt(process.argv[4]) || 10;
    const duration = parseInt(process.argv[5]) || 30;
    
    checker.loadTest(endpoint, concurrent, duration)
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Load test failed:', error.message);
        process.exit(1);
      });
  } else {
    checker.runFullCheck()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Performance check failed:', error.message);
        process.exit(1);
      });
  }
}

module.exports = PerformanceChecker;