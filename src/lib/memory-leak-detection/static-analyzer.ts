/**
 * Static code analysis engine for detecting memory leak patterns
 */

import {
  LeakReport,
  LeakType,
  LeakSeverity,
  CodePattern,
  ASTNode,
  DetectionConfidence,
} from './types';

// Simple AST parser for TypeScript/JavaScript
export class SimpleASTParser {
  private code: string;
  private lines: string[];

  constructor(code: string) {
    this.code = code;
    this.lines = code.split('\n');
  }

  // Find useEffect hooks without cleanup
  findUseEffectWithoutCleanup(): Array<{
    line: number;
    column: number;
    snippet: string;
    hasCleanup: boolean;
  }> {
    const results: Array<{
      line: number;
      column: number;
      snippet: string;
      hasCleanup: boolean;
    }> = [];

    // Pattern to match useEffect calls
    const useEffectPattern = /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{/g;
    const useEffectArrowPattern = /useEffect\s*\(\s*\(\s*\)\s*=>/g;

    let match;

    // Check for useEffect with function body
    while ((match = useEffectPattern.exec(this.code)) !== null) {
      const startIndex = match.index;
      const lineNumber = this.getLineNumber(startIndex);
      const column = this.getColumnNumber(startIndex, lineNumber);

      // Find the complete useEffect block
      const effectBlock = this.extractUseEffectBlock(startIndex);
      if (effectBlock) {
        const hasCleanup = this.hasCleanupFunction(effectBlock.content);
        const hasAsyncOperations = this.hasAsyncOperations(effectBlock.content);

        if (hasAsyncOperations && !hasCleanup) {
          results.push({
            line: lineNumber,
            column,
            snippet: effectBlock.content.substring(0, 100) + '...',
            hasCleanup,
          });
        }
      }
    }

    // Check for arrow function useEffect
    while ((match = useEffectArrowPattern.exec(this.code)) !== null) {
      const startIndex = match.index;
      const lineNumber = this.getLineNumber(startIndex);
      const column = this.getColumnNumber(startIndex, lineNumber);

      const effectBlock = this.extractUseEffectBlock(startIndex);
      if (effectBlock) {
        const hasCleanup = this.hasCleanupFunction(effectBlock.content);
        const hasAsyncOperations = this.hasAsyncOperations(effectBlock.content);

        if (hasAsyncOperations && !hasCleanup) {
          results.push({
            line: lineNumber,
            column,
            snippet: effectBlock.content.substring(0, 100) + '...',
            hasCleanup,
          });
        }
      }
    }

    return results;
  }

  // Find event listeners without removeEventListener
  findEventListenersWithoutCleanup(): Array<{
    line: number;
    column: number;
    snippet: string;
    eventType: string;
    element: string;
  }> {
    const results: Array<{
      line: number;
      column: number;
      snippet: string;
      eventType: string;
      element: string;
    }> = [];

    // Pattern to match addEventListener calls
    const addEventListenerPattern =
      /(\w+)\.addEventListener\s*\(\s*['"`](\w+)['"`]\s*,\s*([^,)]+)/g;

    let match;
    while ((match = addEventListenerPattern.exec(this.code)) !== null) {
      const startIndex = match.index;
      const lineNumber = this.getLineNumber(startIndex);
      const column = this.getColumnNumber(startIndex, lineNumber);
      const element = match[1];
      const eventType = match[2];
      const handler = match[3];

      // Check if there's a corresponding removeEventListener
      const hasRemoveListener = this.hasCorrespondingRemoveEventListener(
        element,
        eventType,
        handler,
        startIndex
      );

      if (!hasRemoveListener) {
        results.push({
          line: lineNumber,
          column,
          snippet: match[0],
          eventType,
          element,
        });
      }
    }

    return results;
  }

  // Extract useEffect block content
  private extractUseEffectBlock(
    startIndex: number
  ): { content: string; endIndex: number } | null {
    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    let i = startIndex;

    // Find the opening brace
    while (i < this.code.length && this.code[i] !== '{') {
      i++;
    }

    if (i >= this.code.length) return null;

    const blockStart = i;
    braceCount = 1;
    i++;

    // Find the matching closing brace
    while (i < this.code.length && braceCount > 0) {
      const char = this.code[i];

      if (!inString) {
        if (char === '"' || char === "'" || char === '`') {
          inString = true;
          stringChar = char;
        } else if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
        }
      } else {
        if (char === stringChar && this.code[i - 1] !== '\\') {
          inString = false;
          stringChar = '';
        }
      }

      i++;
    }

    if (braceCount === 0) {
      return {
        content: this.code.substring(blockStart, i),
        endIndex: i,
      };
    }

    return null;
  }

  // Check if useEffect has cleanup function (return statement)
  private hasCleanupFunction(effectContent: string): boolean {
    // Look for return statement with function
    const returnPattern =
      /return\s+(?:\(\s*\)\s*=>\s*\{|function\s*\(\s*\)\s*\{|\(\s*\)\s*=>\s*[^{])/;
    return returnPattern.test(effectContent);
  }

  // Check if useEffect has async operations that need cleanup
  private hasAsyncOperations(effectContent: string): boolean {
    const asyncPatterns = [
      /addEventListener/,
      /setInterval/,
      /setTimeout/,
      /new\s+EventSource/,
      /new\s+WebSocket/,
      /\.subscribe\s*\(/,
      /\.on\s*\(/,
      /fetch\s*\(/,
      /XMLHttpRequest/,
    ];

    return asyncPatterns.some(pattern => pattern.test(effectContent));
  }

  // Check if there's a corresponding removeEventListener
  private hasCorrespondingRemoveEventListener(
    element: string,
    eventType: string,
    handler: string,
    afterIndex: number
  ): boolean {
    const removePattern = new RegExp(
      `${element}\\.removeEventListener\\s*\\(\\s*['"\`]${eventType}['"\`]\\s*,\\s*${handler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
    );

    // Check in the rest of the code after the addEventListener
    const remainingCode = this.code.substring(afterIndex);
    return removePattern.test(remainingCode);
  }

  // Get line number from character index
  public getLineNumber = (index: number): number => {
    let line = 1;
    for (let i = 0; i < index && i < this.code.length; i++) {
      if (this.code[i] === '\n') {
        line++;
      }
    }
    return line;
  }

  // Get column number from character index and line number
  public getColumnNumber = (index: number, lineNumber: number): number => {
    const lineStart = this.getLineStartIndex(lineNumber);
    return index - lineStart + 1;
  }

  // Get the start index of a line
  private getLineStartIndex(lineNumber: number): number {
    let currentLine = 1;
    for (let i = 0; i < this.code.length; i++) {
      if (currentLine === lineNumber) {
        return i;
      }
      if (this.code[i] === '\n') {
        currentLine++;
      }
    }
    return 0;
  }

  // Get code snippet around a position
  getCodeSnippet(line: number, column: number, contextLines = 2): string {
    const startLine = Math.max(1, line - contextLines);
    const endLine = Math.min(this.lines.length, line + contextLines);

    const snippet = this.lines
      .slice(startLine - 1, endLine)
      .map((lineContent, index) => {
        const lineNum = startLine + index;
        const marker = lineNum === line ? '>' : ' ';
        return `${marker} ${lineNum.toString().padStart(3)}: ${lineContent}`;
      })
      .join('\n');

    return snippet;
  }
}

// Static code analyzer
export class StaticCodeAnalyzer {
  private patterns: CodePattern[];

  constructor() {
    this.patterns = this.initializePatterns();
  }

  // Initialize detection patterns
  private initializePatterns(): CodePattern[] {
    return [
      {
        id: 'useeffect-missing-cleanup',
        name: 'useEffect Missing Cleanup',
        description:
          'useEffect hook with async operations but no cleanup function',
        pattern: /useEffect\s*\(/,
        severity: 'high',
        category: 'missing-useeffect-cleanup',
        fixTemplate: 'Add return statement with cleanup function',
      },
      {
        id: 'event-listener-no-cleanup',
        name: 'Event Listener Without Cleanup',
        description:
          'addEventListener call without corresponding removeEventListener',
        pattern: /addEventListener\s*\(/,
        severity: 'medium',
        category: 'uncleaned-event-listener',
        fixTemplate: 'Add removeEventListener in cleanup',
      },
      {
        id: 'interval-no-cleanup',
        name: 'Interval Without Cleanup',
        description: 'setInterval call without clearInterval',
        pattern: /setInterval\s*\(/,
        severity: 'high',
        category: 'uncleaned-interval',
        fixTemplate: 'Add clearInterval in cleanup',
      },
      {
        id: 'timeout-no-cleanup',
        name: 'Timeout Without Cleanup',
        description: 'setTimeout call without clearTimeout',
        pattern: /setTimeout\s*\(/,
        severity: 'medium',
        category: 'uncleaned-timeout',
        fixTemplate: 'Add clearTimeout in cleanup',
      },
      {
        id: 'eventsource-no-close',
        name: 'EventSource Without Close',
        description: 'EventSource connection without close() call',
        pattern: /new\s+EventSource\s*\(/,
        severity: 'high',
        category: 'unclosed-eventsource',
        fixTemplate: 'Add EventSource.close() in cleanup',
      },
      {
        id: 'websocket-no-close',
        name: 'WebSocket Without Close',
        description: 'WebSocket connection without close() call',
        pattern: /new\s+WebSocket\s*\(/,
        severity: 'high',
        category: 'unclosed-websocket',
        fixTemplate: 'Add WebSocket.close() in cleanup',
      },
    ];
  }

  // Analyze a file for memory leaks
  async analyzeFile(filePath: string, code: string): Promise<LeakReport[]> {
    const reports: LeakReport[] = [];
    const parser = new SimpleASTParser(code);

    try {
      // Analyze useEffect hooks
      const useEffectIssues = parser.findUseEffectWithoutCleanup();
      for (const issue of useEffectIssues) {
        reports.push(
          this.createLeakReport(
            'missing-useeffect-cleanup',
            'high',
            0.8,
            filePath,
            issue.line,
            issue.column,
            'useEffect hook with async operations missing cleanup function',
            'Add a return statement with cleanup function to prevent memory leaks',
            issue.snippet,
            { hookName: 'useEffect' }
          )
        );
      }

      // Analyze event listeners
      const eventListenerIssues = parser.findEventListenersWithoutCleanup();
      for (const issue of eventListenerIssues) {
        reports.push(
          this.createLeakReport(
            'uncleaned-event-listener',
            'medium',
            0.7,
            filePath,
            issue.line,
            issue.column,
            `Event listener '${issue.eventType}' on '${issue.element}' without cleanup`,
            `Add ${issue.element}.removeEventListener('${issue.eventType}', handler) in cleanup`,
            issue.snippet,
            { eventType: issue.eventType, element: issue.element }
          )
        );
      }

      // Analyze intervals and timeouts
      this.analyzeTimers(code, filePath, reports, parser);

      // Analyze connections
      this.analyzeConnections(code, filePath, reports, parser);
    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error);
    }

    return reports;
  }

  // Analyze timer-related leaks
  private analyzeTimers(
    code: string,
    filePath: string,
    reports: LeakReport[],
    parser: SimpleASTParser
  ): void {
    // Find setInterval without clearInterval
    const intervalPattern = /setInterval\s*\(/g;
    let match;

    while ((match = intervalPattern.exec(code)) !== null) {
      const startIndex = match.index;
      const line = parser.getLineNumber(startIndex);
      const column = parser.getColumnNumber(startIndex, line);

      // Check if there's a corresponding clearInterval
      const hasClearInterval = /clearInterval\s*\(/.test(
        code.substring(startIndex)
      );

      if (!hasClearInterval) {
        reports.push(
          this.createLeakReport(
            'uncleaned-interval',
            'high',
            0.8,
            filePath,
            line,
            column,
            'setInterval call without corresponding clearInterval',
            'Store interval ID and call clearInterval in cleanup function',
            parser.getCodeSnippet(line, column),
            { timerType: 'interval' }
          )
        );
      }
    }

    // Find setTimeout without clearTimeout (in useEffect context)
    const timeoutPattern = /setTimeout\s*\(/g;
    while ((match = timeoutPattern.exec(code)) !== null) {
      const startIndex = match.index;
      const line = parser.getLineNumber(startIndex);
      const column = parser.getColumnNumber(startIndex, line);

      // Check if it's inside a useEffect
      const beforeCode = code.substring(0, startIndex);
      const isInUseEffect = /useEffect\s*\([^}]*$/.test(beforeCode);

      if (isInUseEffect) {
        const hasClearTimeout = /clearTimeout\s*\(/.test(
          code.substring(startIndex)
        );

        if (!hasClearTimeout) {
          reports.push(
            this.createLeakReport(
              'uncleaned-timeout',
              'medium',
              0.6,
              filePath,
              line,
              column,
              'setTimeout in useEffect without clearTimeout cleanup',
              'Store timeout ID and call clearTimeout in cleanup function',
              parser.getCodeSnippet(line, column),
              { timerType: 'timeout' }
            )
          );
        }
      }
    }
  }

  // Analyze connection-related leaks
  private analyzeConnections(
    code: string,
    filePath: string,
    reports: LeakReport[],
    parser: SimpleASTParser
  ): void {
    // Find EventSource without close
    const eventSourcePattern = /new\s+EventSource\s*\(/g;
    let match;

    while ((match = eventSourcePattern.exec(code)) !== null) {
      const startIndex = match.index;
      const line = parser.getLineNumber(startIndex);
      const column = parser.getColumnNumber(startIndex, line);

      // Check if there's a corresponding close() call
      const hasClose = /\.close\s*\(\s*\)/.test(code.substring(startIndex));

      if (!hasClose) {
        reports.push(
          this.createLeakReport(
            'unclosed-eventsource',
            'high',
            0.9,
            filePath,
            line,
            column,
            'EventSource connection without close() call',
            'Call eventSource.close() in cleanup function',
            parser.getCodeSnippet(line, column),
            { connectionType: 'EventSource' }
          )
        );
      }
    }

    // Find WebSocket without close
    const webSocketPattern = /new\s+WebSocket\s*\(/g;
    while ((match = webSocketPattern.exec(code)) !== null) {
      const startIndex = match.index;
      const line = parser.getLineNumber(startIndex);
      const column = parser.getColumnNumber(startIndex, line);

      // Check if there's a corresponding close() call
      const hasClose = /\.close\s*\(\s*\)/.test(code.substring(startIndex));

      if (!hasClose) {
        reports.push(
          this.createLeakReport(
            'unclosed-websocket',
            'high',
            0.9,
            filePath,
            line,
            column,
            'WebSocket connection without close() call',
            'Call webSocket.close() in cleanup function',
            parser.getCodeSnippet(line, column),
            { connectionType: 'WebSocket' }
          )
        );
      }
    }
  }

  // Create a leak report
  private createLeakReport(
    type: LeakType,
    severity: LeakSeverity,
    confidence: DetectionConfidence,
    file: string,
    line: number,
    column: number,
    description: string,
    suggestedFix: string,
    codeSnippet: string,
    context: Record<string, any>
  ): LeakReport {
    return {
      id: `${type}-${file}-${line}-${column}`,
      type,
      severity,
      confidence,
      file,
      line,
      column,
      description,
      suggestedFix,
      codeSnippet,
      context,
      metadata: {
        detectedAt: new Date(),
        detectionMethod: 'static',
        ruleId: `static-${type}`,
        category: 'memory-leak',
      },
    };
  }

  // Get severity score for prioritization
  getSeverityScore(severity: LeakSeverity): number {
    const scores = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    return scores[severity];
  }

  // Filter reports by confidence threshold
  filterByConfidence(
    reports: LeakReport[],
    threshold: DetectionConfidence
  ): LeakReport[] {
    return reports.filter(report => report.confidence >= threshold);
  }

  // Group reports by type
  groupByType(reports: LeakReport[]): Record<LeakType, LeakReport[]> {
    const grouped: Record<string, LeakReport[]> = {};

    for (const report of reports) {
      if (!grouped[report.type]) {
        grouped[report.type] = [];
      }
      grouped[report.type].push(report);
    }

    return grouped as Record<LeakType, LeakReport[]>;
  }

  // Sort reports by severity and confidence
  sortReports(reports: LeakReport[]): LeakReport[] {
    return reports.sort((a, b) => {
      const severityDiff =
        this.getSeverityScore(b.severity) - this.getSeverityScore(a.severity);
      if (severityDiff !== 0) return severityDiff;

      return b.confidence - a.confidence;
    });
  }
}
