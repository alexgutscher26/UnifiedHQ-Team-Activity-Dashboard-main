#!/usr/bin/env node

// Memory leak detection CLI script
// This script requires tsx or ts-node to run TypeScript files

/**
 * Main function to execute the memory leak detection CLI.
 *
 * This function imports the TypeScript module for memory leak detection, parses command line arguments for options,
 * and initiates the memory leak scan using the provided options. It handles errors related to module import and
 * execution, providing user-friendly messages for required dependencies and usage instructions.
 *
 * @returns {Promise<void>} A promise that resolves when the memory leak detection process is complete.
 * @throws Error If there is an issue with importing the TypeScript module or during the execution of the scan.
 */
async function main() {
  let cliScan;

  try {
    // Try to import the TypeScript module
    const module = await import('../src/lib/memory-leak-detection/index.ts');
    cliScan = module.cliScan;
  } catch (error) {
    console.error('Error: This script requires a TypeScript runner.');
    console.error('Please install and use tsx or ts-node:');
    console.error('');
    console.error('Option 1 - Using tsx:');
    console.error('  npm install -g tsx');
    console.error('  tsx scripts/memory-leak-scan.js');
    console.error('');
    console.error('Option 2 - Using ts-node:');
    console.error('  npm install -g ts-node');
    console.error('  ts-node --esm scripts/memory-leak-scan.js');
    console.error('');
    console.error('Option 3 - Using npx:');
    console.error('  npx tsx scripts/memory-leak-scan.js');
    console.error('');
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const options = {
    output: 'summary',
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--output':
        options.output = args[++i];
        break;
      case '--files':
        options.files = args[++i].split(',');
        break;
      case '--severity':
        options.severity = args[++i];
        break;
      case '--confidence':
        options.confidence = parseFloat(args[++i]);
        break;
      case '--help':
        console.log(`
Memory Leak Detection CLI

Usage: node scripts/memory-leak-scan.js [options]

Options:
  --output <format>     Output format: json, table, summary (default: summary)
  --files <files>       Comma-separated list of files to scan
  --severity <level>    Filter by severity: low, medium, high, critical
  --confidence <num>    Filter by confidence threshold (0-1)
  --help               Show this help message

Examples:
  node scripts/memory-leak-scan.js
  node scripts/memory-leak-scan.js --output json
  node scripts/memory-leak-scan.js --files src/components/Button.tsx,src/hooks/useData.ts
  node scripts/memory-leak-scan.js --severity high --confidence 0.8
        `);
        process.exit(0);
        break;
    }
  }

  try {
    console.log('Starting memory leak detection...\n');
    const reports = await cliScan(options);

    if (reports.length === 0) {
      console.log('✅ No memory leaks detected!');
    } else {
      console.log(`\n⚠️  Found ${reports.length} potential memory leak(s)`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error running memory leak detection:', error.message);
    process.exit(1);
  }
}

main();
