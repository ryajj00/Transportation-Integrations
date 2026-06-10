const tests = require('./fareCalculator.test');

let passed = 0;
for (let i = 0; i < tests.length; i++) {
  try {
    tests[i]();
    console.log(`ok ${i + 1}`);
    passed++;
  } catch (err) {
    console.error(`FAIL ${i + 1}:`, err.message);
    process.exitCode = 1;
  }
}

console.log(`${passed}/${tests.length} tests passed`);
