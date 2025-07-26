const { execSync } = require('child_process');
const path = require('path');

/**
 * Comprehensive Test Runner for yToo Backend
 * Runs all test suites and generates coverage reports
 */

const testSuites = [
  {
    name: 'User Workflow Integration Tests',
    pattern: '__tests__/user-workflow-integration.test.js',
    description: 'Complete user workflows from registration to voting'
  },
  {
    name: 'Privacy Requirements Tests',
    pattern: '__tests__/privacy-requirements.test.js',
    description: 'End-to-end privacy compliance verification'
  },
  {
    name: 'WebSocket Real-time Tests',
    pattern: '__tests__/websocket-realtime.test.js',
    description: 'Real-time functionality and WebSocket events'
  },
  {
    name: 'Performance & Concurrent Tests',
    pattern: '__tests__/performance-concurrent.test.js',
    description: 'Performance tests for concurrent voting scenarios'
  },
  {
    name: 'Unit Tests',
    pattern: '**/__tests__/**/*.test.js',
    exclude: '__tests__/*.test.js',
    description: 'All unit tests for models, services, and middleware'
  }
];

function runTestSuite(suite) {
  console.log(`\n🧪 Running ${suite.name}`);
  console.log(`📝 ${suite.description}`);
  console.log('─'.repeat(60));

  try {
    const command = suite.exclude 
      ? `jest ${suite.pattern} --testPathIgnorePatterns=${suite.exclude}`
      : `jest ${suite.pattern}`;
    
    execSync(command, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    console.log(`✅ ${suite.name} - PASSED`);
    return true;
  } catch (error) {
    console.log(`❌ ${suite.name} - FAILED`);
    return false;
  }
}

function runAllTests() {
  console.log('🚀 Starting Comprehensive Test Suite for yToo Backend');
  console.log('═'.repeat(60));
  
  const results = [];
  
  for (const suite of testSuites) {
    const passed = runTestSuite(suite);
    results.push({ name: suite.name, passed });
  }
  
  console.log('\n📊 Test Results Summary');
  console.log('═'.repeat(60));
  
  let totalPassed = 0;
  results.forEach(result => {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`${status} - ${result.name}`);
    if (result.passed) totalPassed++;
  });
  
  console.log('─'.repeat(60));
  console.log(`Total: ${totalPassed}/${results.length} test suites passed`);
  
  if (totalPassed === results.length) {
    console.log('🎉 All tests passed! The application meets all requirements.');
  } else {
    console.log('⚠️  Some tests failed. Please review the output above.');
    process.exit(1);
  }
}

function runCoverageReport() {
  console.log('\n📈 Generating Coverage Report');
  console.log('═'.repeat(60));
  
  try {
    execSync('jest --coverage --coverageReporters=text --coverageReporters=html', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    console.log('\n✅ Coverage report generated successfully');
    console.log('📁 HTML report available in coverage/lcov-report/index.html');
  } catch (error) {
    console.log('❌ Failed to generate coverage report');
  }
}

function runPrivacyTests() {
  console.log('\n🔒 Running Privacy Compliance Tests');
  console.log('═'.repeat(60));
  
  try {
    execSync('jest __tests__/privacy-requirements.test.js --verbose', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    console.log('✅ Privacy compliance verified');
  } catch (error) {
    console.log('❌ Privacy compliance tests failed');
    process.exit(1);
  }
}

function runPerformanceTests() {
  console.log('\n⚡ Running Performance Tests');
  console.log('═'.repeat(60));
  
  try {
    execSync('jest __tests__/performance-concurrent.test.js --verbose --testTimeout=30000', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    console.log('✅ Performance tests completed');
  } catch (error) {
    console.log('❌ Performance tests failed');
    process.exit(1);
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'all':
    runAllTests();
    break;
  case 'coverage':
    runCoverageReport();
    break;
  case 'privacy':
    runPrivacyTests();
    break;
  case 'performance':
    runPerformanceTests();
    break;
  case 'integration':
    runTestSuite(testSuites[0]); // User workflow integration
    break;
  case 'realtime':
    runTestSuite(testSuites[2]); // WebSocket real-time
    break;
  default:
    console.log('🧪 yToo Backend Test Runner');
    console.log('═'.repeat(40));
    console.log('Available commands:');
    console.log('  all         - Run all test suites');
    console.log('  coverage    - Generate coverage report');
    console.log('  privacy     - Run privacy compliance tests');
    console.log('  performance - Run performance tests');
    console.log('  integration - Run integration tests');
    console.log('  realtime    - Run real-time tests');
    console.log('\nUsage: node test-runner.js [command]');
}