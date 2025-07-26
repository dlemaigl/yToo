import { execSync } from 'child_process';
import path from 'path';

/**
 * Comprehensive Test Runner for yToo Frontend
 * Runs all test suites and generates coverage reports
 */

interface TestSuite {
  name: string;
  pattern: string;
  description: string;
  exclude?: string;
}

const testSuites: TestSuite[] = [
  {
    name: 'Integration Tests',
    pattern: '__tests__/integration/**/*.test.tsx',
    description: 'Complete user workflow integration tests'
  },
  {
    name: 'Privacy Compliance Tests',
    pattern: '__tests__/privacy/**/*.test.tsx',
    description: 'Privacy requirements and data protection tests'
  },
  {
    name: 'Real-time WebSocket Tests',
    pattern: '__tests__/realtime/**/*.test.tsx',
    description: 'WebSocket integration and real-time functionality tests'
  },
  {
    name: 'Component Unit Tests',
    pattern: 'components/**/*.test.tsx',
    description: 'Individual component unit tests'
  },
  {
    name: 'Hook Tests',
    pattern: 'hooks/**/*.test.ts',
    description: 'Custom React hooks tests'
  },
  {
    name: 'Context Tests',
    pattern: 'contexts/**/*.test.tsx',
    description: 'React context provider tests'
  },
  {
    name: 'Page Tests',
    pattern: 'pages/**/*.test.tsx',
    description: 'Page component integration tests'
  }
];

function runTestSuite(suite: TestSuite): boolean {
  console.log(`\n🧪 Running ${suite.name}`);
  console.log(`📝 ${suite.description}`);
  console.log('─'.repeat(60));

  try {
    const command = suite.exclude 
      ? `npm test -- --testPathPattern=${suite.pattern} --testPathIgnorePatterns=${suite.exclude} --watchAll=false`
      : `npm test -- --testPathPattern=${suite.pattern} --watchAll=false`;
    
    execSync(command, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '../../..')
    });
    
    console.log(`✅ ${suite.name} - PASSED`);
    return true;
  } catch (error) {
    console.log(`❌ ${suite.name} - FAILED`);
    return false;
  }
}

function runAllTests(): void {
  console.log('🚀 Starting Comprehensive Test Suite for yToo Frontend');
  console.log('═'.repeat(60));
  
  const results: Array<{ name: string; passed: boolean }> = [];
  
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

function runCoverageReport(): void {
  console.log('\n📈 Generating Coverage Report');
  console.log('═'.repeat(60));
  
  try {
    execSync('npm test -- --coverage --watchAll=false --coverageReporters=text --coverageReporters=html', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../../..')
    });
    
    console.log('\n✅ Coverage report generated successfully');
    console.log('📁 HTML report available in coverage/lcov-report/index.html');
  } catch (error) {
    console.log('❌ Failed to generate coverage report');
  }
}

function runPrivacyTests(): void {
  console.log('\n🔒 Running Privacy Compliance Tests');
  console.log('═'.repeat(60));
  
  try {
    execSync('npm test -- --testPathPattern=__tests__/privacy --watchAll=false --verbose', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../../..')
    });
    
    console.log('✅ Privacy compliance verified');
  } catch (error) {
    console.log('❌ Privacy compliance tests failed');
    process.exit(1);
  }
}

function runIntegrationTests(): void {
  console.log('\n🔗 Running Integration Tests');
  console.log('═'.repeat(60));
  
  try {
    execSync('npm test -- --testPathPattern=__tests__/integration --watchAll=false --verbose', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../../..')
    });
    
    console.log('✅ Integration tests completed');
  } catch (error) {
    console.log('❌ Integration tests failed');
    process.exit(1);
  }
}

function runRealTimeTests(): void {
  console.log('\n⚡ Running Real-time Tests');
  console.log('═'.repeat(60));
  
  try {
    execSync('npm test -- --testPathPattern=__tests__/realtime --watchAll=false --verbose', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../../..')
    });
    
    console.log('✅ Real-time tests completed');
  } catch (error) {
    console.log('❌ Real-time tests failed');
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
  case 'integration':
    runIntegrationTests();
    break;
  case 'realtime':
    runRealTimeTests();
    break;
  default:
    console.log('🧪 yToo Frontend Test Runner');
    console.log('═'.repeat(40));
    console.log('Available commands:');
    console.log('  all         - Run all test suites');
    console.log('  coverage    - Generate coverage report');
    console.log('  privacy     - Run privacy compliance tests');
    console.log('  integration - Run integration tests');
    console.log('  realtime    - Run real-time tests');
    console.log('\nUsage: npx ts-node test-runner.ts [command]');
}