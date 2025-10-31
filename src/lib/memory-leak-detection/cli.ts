#!/usr/bin/env node

/**
 * CLI tool for memory leak detection
 *
 * Usage:
 *   npx tsx src/lib/memory-leak-detection/cli.ts <file>
 *   npx tsx src/lib/memory-leak-detection/cli.ts --test
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  analyzeCodeForMemoryLeaks,
  generateMemoryLeakReport,
} from './code-analyzer';
import { runTests } from './__tests__/run-tests';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  npx tsx src/lib/memory-leak-detection/cli.ts <file>');
    console.log('  npx tsx src/lib/memory-leak-detection/cli.ts --test');
    console.log(
      '  npx tsx src/lib/memory-leak-detection/cli.ts --analyze-project'
    );
    throw new Error('Invalid usage - missing required arguments');
  }

  const command = args[0];

  switch (command) {
    case '--test':
      console.log('🧪 Running memory leak detection tests...\n');
      await runTests();
      break;

    case '--analyze-project':
      await analyzeProject();
      break;

    default:
      await analyzeFile(command);
      break;
  }
}

/**
 * Analyze a single file
 */
async function analyzeFile(filePath: string) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      throw new Error(`File not found: ${filePath}`);
    }

    const code = fs.readFileSync(filePath, 'utf-8');
    const analysis = analyzeCodeForMemoryLeaks(code, filePath);
    const report = generateMemoryLeakReport(analysis);

    console.log(`📁 Analyzing: ${filePath}\n`);
    console.log(report);

    if (analysis.hasMemoryLeaks) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exitCode = 1;
    throw error;
  }
}

/**
 * Analyze entire project
 */
async function analyzeProject() {
  console.log('🔍 Analyzing entire project for memory leaks...\n');

  const srcDir = path.join(process.cwd(), 'src');
  const files = findReactFiles(srcDir);

  let totalFiles = 0;
  let filesWithIssues = 0;
  let totalLeaks = 0;

  console.log(`Found ${files.length} React files to analyze\n`);

  for (const file of files) {
    try {
      const code = fs.readFileSync(file, 'utf-8');
      const analysis = analyzeCodeForMemoryLeaks(code, file);

      totalFiles++;

      if (analysis.hasMemoryLeaks) {
        filesWithIssues++;
        totalLeaks += analysis.leaks.length;

        console.log(`❌ ${path.relative(process.cwd(), file)}`);
        console.log(`   Score: ${analysis.score}/100`);
        console.log(`   Issues: ${analysis.leaks.length}`);

        analysis.leaks.forEach(leak => {
          console.log(`   • ${leak.description} (Line ${leak.line})`);
        });
        console.log('');
      } else {
        console.log(
          `✅ ${path.relative(process.cwd(), file)} - Clean (${analysis.score}/100)`
        );
      }
    } catch (error) {
      console.error(`❌ Failed to analyze ${file}:`, error);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Project Analysis Summary:');
  console.log(`Total files analyzed: ${totalFiles}`);
  console.log(`Files with issues: ${filesWithIssues}`);
  console.log(`Total memory leaks: ${totalLeaks}`);
  console.log(`Clean files: ${totalFiles - filesWithIssues}`);
  console.log(
    `Success rate: ${(((totalFiles - filesWithIssues) / totalFiles) * 100).toFixed(1)}%`
  );

  if (filesWithIssues > 0) {
    console.log('\n💡 Recommendations:');
    console.log('• Add cleanup functions to useEffect hooks');
    console.log('• Remove event listeners in cleanup functions');
    console.log('• Clear intervals and timeouts');
    console.log('• Close EventSource and WebSocket connections');
    console.log('• Unsubscribe from observables and subscriptions');

    process.exit(1);
  } else {
    console.log('\n🎉 All files are clean! No memory leaks detected.');
  }
}

/**
 * Find all React files in a directory
 */
function findReactFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and other irrelevant directories
      if (
        !['node_modules', '.git', '.next', 'dist', 'build'].includes(entry.name)
      ) {
        files.push(...findReactFiles(fullPath));
      }
    } else if (entry.isFile()) {
      // Include React component files
      if (
        /\.(tsx?|jsx?)$/.test(entry.name) &&
        !entry.name.endsWith('.test.tsx') &&
        !entry.name.endsWith('.test.ts')
      ) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Interactive mode for analyzing specific patterns
 */
async function interactiveMode() {
  console.log('🔍 Interactive Memory Leak Analysis');
  console.log('Enter your React code (end with Ctrl+D):');

  let code = '';
  process.stdin.setEncoding('utf-8');

  for await (const chunk of process.stdin) {
    code += chunk;
  }

  if (code.trim()) {
    const analysis = analyzeCodeForMemoryLeaks(code, 'interactive.tsx');
    const report = generateMemoryLeakReport(analysis);
    console.log('\n' + report);
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { analyzeFile, analyzeProject, findReactFiles };
