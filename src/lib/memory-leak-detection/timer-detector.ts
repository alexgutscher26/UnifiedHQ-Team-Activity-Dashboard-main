/**
 * Specialized detector for interval and timeout memory leaks
 */

import {
  LeakReport,
  LeakSeverity,
  DetectionConfidence,
  ActiveResources,
} from './types';
import { SimpleASTParser } from './static-analyzer';

// Timer leak patterns and their severity
interface TimerPattern {
  pattern: RegExp;
  type: 'interval' | 'timeout';
  severity: LeakSeverity;
  description: string;
  fixSuggestion: string;
}

// Timer usage context
interface TimerContext {
  isInReactComponent: boolean;
  isInUseEffect: boolean;
  isInEventHandler: boolean;
  hasCleanup: boolean;
  variableName?: string;
  functionContext?: string;
}

// Timer leak detector
export class TimerLeakDetector {
  private patterns: TimerPattern[];
  private activeTimers: Map<
    number,
    { type: 'interval' | 'timeout'; createdAt: Date; context?: string }
  >;

  constructor() {
    this.patterns = this.initializePatterns();
    this.activeTimers = new Map();
  }

  // Initialize timer detection patterns
  private initializePatterns(): TimerPattern[] {
    return [
      {
        pattern: /setInterval\s*\(\s*[^,]+\s*,\s*\d+\s*\)/g,
        type: 'interval',
        severity: 'high',
        description: 'setInterval without clearInterval cleanup',
        fixSuggestion:
          'Store interval ID and call clearInterval in cleanup function',
      },
      {
        pattern: /setTimeout\s*\(\s*[^,]+\s*,\s*\d+\s*\)/g,
        type: 'timeout',
        severity: 'medium',
        description: 'setTimeout in component without clearTimeout cleanup',
        fixSuggestion:
          'Store timeout ID and call clearTimeout in cleanup function',
      },
      {
        pattern: /window\.setInterval\s*\(/g,
        type: 'interval',
        severity: 'high',
        description: 'Global setInterval without cleanup',
        fixSuggestion: 'Use clearInterval to clean up global intervals',
      },
      {
        pattern: /window\.setTimeout\s*\(/g,
        type: 'timeout',
        severity: 'medium',
        description: 'Global setTimeout without cleanup',
        fixSuggestion: 'Use clearTimeout to clean up global timeouts',
      },
    ];
  }

  // Analyze code for timer leaks
  async analyzeTimerLeaks(
    filePath: string,
    code: string
  ): Promise<LeakReport[]> {
    const reports: LeakReport[] = [];
    const parser = new SimpleASTParser(code);

    try {
      // Find all timer usages
      const timerUsages = this.findTimerUsages(code);

      for (const usage of timerUsages) {
        const context = this.analyzeTimerContext(code, usage.index);
        const severity = this.assessTimerSeverity(usage, context);

        if (this.isLeakyTimer(usage, context)) {
          const line = parser['getLineNumber'](usage.index);
          const column = parser['getColumnNumber'](usage.index, line);

          reports.push(
            this.createTimerLeakReport(
              usage,
              context,
              severity,
              filePath,
              line,
              column,
              parser.getCodeSnippet(line, column)
            )
          );
        }
      }

      // Analyze timer cleanup patterns
      const cleanupIssues = this.analyzeTimerCleanup(code);
      for (const issue of cleanupIssues) {
        const line = parser['getLineNumber'](issue.index);
        const column = parser['getColumnNumber'](issue.index, line);

        reports.push(
          this.createCleanupIssueReport(
            issue,
            filePath,
            line,
            column,
            parser.getCodeSnippet(line, column)
          )
        );
      }
    } catch (error) {
      console.error(`Error analyzing timer leaks in ${filePath}:`, error);
    }

    return reports;
  }

  // Find all timer usages in code
  private findTimerUsages(code: string): Array<{
    type: 'interval' | 'timeout';
    match: string;
    index: number;
    variableName?: string;
    delay?: number;
  }> {
    const usages: Array<{
      type: 'interval' | 'timeout';
      match: string;
      index: number;
      variableName?: string;
      delay?: number;
    }> = [];

    // Find setInterval usages
    const intervalPattern =
      /(?:const|let|var)?\s*(\w+)?\s*=?\s*setInterval\s*\(\s*[^,]+\s*,\s*(\d+)\s*\)/g;
    let match;

    while ((match = intervalPattern.exec(code)) !== null) {
      usages.push({
        type: 'interval',
        match: match[0],
        index: match.index,
        variableName: match[1],
        delay: parseInt(match[2], 10),
      });
    }

    // Find setTimeout usages
    const timeoutPattern =
      /(?:const|let|var)?\s*(\w+)?\s*=?\s*setTimeout\s*\(\s*[^,]+\s*,\s*(\d+)\s*\)/g;
    while ((match = timeoutPattern.exec(code)) !== null) {
      usages.push({
        type: 'timeout',
        match: match[0],
        index: match.index,
        variableName: match[1],
        delay: parseInt(match[2], 10),
      });
    }

    return usages;
  }

  // Analyze the context where timer is used
  /**
   * Analyzes the context of a timer in a given code string.
   */
  private analyzeTimerContext(code: string, timerIndex: number): TimerContext {
    const beforeCode = code.substring(0, timerIndex);
    const afterCode = code.substring(timerIndex);

    // Check if in React component
    const isInReactComponent =
      /(?:function|const)\s+\w+.*(?:React\.Component|extends Component|\(\s*\)\s*=>|\(\s*props\s*\)\s*=>)/.test(
        beforeCode
      );

    // Check if in useEffect
    const useEffectMatch = beforeCode.match(/useEffect\s*\([^}]*$/);
    const isInUseEffect = Boolean(useEffectMatch);

    // Check if in event handler
    const isInEventHandler =
      /(?:onClick|onSubmit|onLoad|addEventListener)\s*[=:]\s*[^}]*$/.test(
        beforeCode
      );

    // Check if there's cleanup
    const hasCleanup = this.hasTimerCleanup(afterCode, timerIndex);

    // Extract function context
    const functionMatch = beforeCode.match(/(?:function|const)\s+(\w+)/);
    const functionContext = functionMatch ? functionMatch[1] : undefined;

    return {
      isInReactComponent,
      isInUseEffect,
      isInEventHandler,
      hasCleanup,
      functionContext,
    };
  }

  // Check if timer has proper cleanup
  private hasTimerCleanup(codeAfterTimer: string, timerIndex: number): boolean {
    // Look for clearInterval or clearTimeout in the same scope
    const clearIntervalPattern = /clearInterval\s*\(/;
    const clearTimeoutPattern = /clearTimeout\s*\(/;

    return (
      clearIntervalPattern.test(codeAfterTimer) ||
      clearTimeoutPattern.test(codeAfterTimer)
    );
  }

  // Assess severity based on timer usage and context
  private assessTimerSeverity(
    usage: { type: 'interval' | 'timeout'; delay?: number },
    context: TimerContext
  ): LeakSeverity {
    // Critical: Long-running intervals in React components without cleanup
    if (
      usage.type === 'interval' &&
      context.isInReactComponent &&
      !context.hasCleanup
    ) {
      return 'critical';
    }

    // High: Intervals without cleanup or short intervals
    if (
      usage.type === 'interval' &&
      (!context.hasCleanup || (usage.delay && usage.delay < 1000))
    ) {
      return 'high';
    }

    // High: Timeouts in useEffect without cleanup
    if (
      usage.type === 'timeout' &&
      context.isInUseEffect &&
      !context.hasCleanup
    ) {
      return 'high';
    }

    // Medium: Timeouts in React components without cleanup
    if (
      usage.type === 'timeout' &&
      context.isInReactComponent &&
      !context.hasCleanup
    ) {
      return 'medium';
    }

    // Low: Other timeout cases
    return 'low';
  }

  // Determine if timer usage is leaky
  private isLeakyTimer(
    usage: { type: 'interval' | 'timeout' },
    context: TimerContext
  ): boolean {
    // Always leaky if no cleanup
    if (!context.hasCleanup) {
      // Intervals are always leaky without cleanup
      if (usage.type === 'interval') return true;

      // Timeouts are leaky in React components or useEffect
      if (
        usage.type === 'timeout' &&
        (context.isInReactComponent || context.isInUseEffect)
      ) {
        return true;
      }
    }

    return false;
  }

  // Analyze timer cleanup patterns
  private analyzeTimerCleanup(code: string): Array<{
    type: 'missing-variable' | 'wrong-cleanup' | 'unreachable-cleanup';
    index: number;
    description: string;
  }> {
    const issues: Array<{
      type: 'missing-variable' | 'wrong-cleanup' | 'unreachable-cleanup';
      index: number;
      description: string;
    }> = [];

    // Find timers without variable assignment
    const unassignedTimerPattern =
      /(?<!(?:const|let|var)\s+\w+\s*=\s*)(?:setInterval|setTimeout)\s*\(/g;
    let match;

    while ((match = unassignedTimerPattern.exec(code)) !== null) {
      issues.push({
        type: 'missing-variable',
        index: match.index,
        description: 'Timer created without storing ID for cleanup',
      });
    }

    // Find cleanup calls without corresponding timer variables
    const clearPattern = /clear(?:Interval|Timeout)\s*\(\s*(\w+)\s*\)/g;
    while ((match = clearPattern.exec(code)) !== null) {
      const variableName = match[1];
      const beforeCode = code.substring(0, match.index);

      // Check if variable was assigned from a timer
      const timerAssignmentPattern = new RegExp(
        `(?:const|let|var)\\s+${variableName}\\s*=\\s*set(?:Interval|Timeout)`
      );

      if (!timerAssignmentPattern.test(beforeCode)) {
        issues.push({
          type: 'wrong-cleanup',
          index: match.index,
          description: `Cleanup call for '${variableName}' but no corresponding timer assignment found`,
        });
      }
    }

    return issues;
  }

  // Create timer leak report
  private createTimerLeakReport(
    usage: {
      type: 'interval' | 'timeout';
      match: string;
      variableName?: string;
      delay?: number;
    },
    context: TimerContext,
    severity: LeakSeverity,
    filePath: string,
    line: number,
    column: number,
    codeSnippet: string
  ): LeakReport {
    const leakType =
      usage.type === 'interval' ? 'uncleaned-interval' : 'uncleaned-timeout';
    const cleanupFunction =
      usage.type === 'interval' ? 'clearInterval' : 'clearTimeout';

    let description = `${usage.type === 'interval' ? 'setInterval' : 'setTimeout'} call without cleanup`;
    if (context.isInReactComponent) description += ' in React component';
    if (context.isInUseEffect) description += ' in useEffect hook';

    let suggestedFix = `Store timer ID and call ${cleanupFunction} in cleanup function`;
    if (context.isInUseEffect) {
      suggestedFix = `Add return statement: return () => ${cleanupFunction}(timerId)`;
    }

    const confidence = this.calculateConfidence(usage, context);

    return {
      id: `${leakType}-${filePath}-${line}-${column}`,
      type: leakType,
      severity,
      confidence,
      file: filePath,
      line,
      column,
      description,
      suggestedFix,
      codeSnippet,
      context: {
        functionName: context.functionContext,
        variableName: usage.variableName,
      },
      metadata: {
        detectedAt: new Date(),
        detectionMethod: 'static',
        ruleId: `timer-${usage.type}-leak`,
        category: 'timer-leak',
      },
    };
  }

  // Create cleanup issue report
  private createCleanupIssueReport(
    issue: { type: string; description: string },
    filePath: string,
    line: number,
    column: number,
    codeSnippet: string
  ): LeakReport {
    return {
      id: `timer-cleanup-${filePath}-${line}-${column}`,
      type: 'uncleaned-interval', // Generic type for cleanup issues
      severity: 'medium',
      confidence: 0.7,
      file: filePath,
      line,
      column,
      description: issue.description,
      suggestedFix: 'Ensure timer ID is stored and properly cleaned up',
      codeSnippet,
      context: {
        variableName: issue.type,
      },
      metadata: {
        detectedAt: new Date(),
        detectionMethod: 'static',
        ruleId: 'timer-cleanup-issue',
        category: 'timer-cleanup',
      },
    };
  }

  // Calculate detection confidence
  private calculateConfidence(
    usage: { type: 'interval' | 'timeout'; variableName?: string },
    context: TimerContext
  ): DetectionConfidence {
    let confidence = 0.5;

    // Higher confidence for intervals
    if (usage.type === 'interval') confidence += 0.2;

    // Higher confidence in React components
    if (context.isInReactComponent) confidence += 0.2;

    // Higher confidence in useEffect
    if (context.isInUseEffect) confidence += 0.2;

    // Lower confidence if variable is assigned (might have cleanup)
    if (usage.variableName) confidence -= 0.1;

    // Higher confidence if no cleanup detected
    if (!context.hasCleanup) confidence += 0.2;

    return Math.min(1.0, Math.max(0.1, confidence));
  }

  // Runtime timer tracking
  trackTimer(id: number, type: 'interval' | 'timeout', context?: string): void {
    this.activeTimers.set(id, {
      type,
      createdAt: new Date(),
      context,
    });
  }

  // Remove timer from tracking
  untrackTimer(id: number): void {
    this.activeTimers.delete(id);
  }

  // Get active timers
  getActiveTimers(): ActiveResources['intervals'] &
    ActiveResources['timeouts'] {
    const intervals: ActiveResources['intervals'] = [];
    const timeouts: ActiveResources['timeouts'] = [];

    for (const [id, timer] of this.activeTimers.entries()) {
      const timerInfo = {
        id,
        addedAt: timer.createdAt,
      };

      if (timer.type === 'interval') {
        intervals.push(timerInfo);
      } else {
        timeouts.push(timerInfo);
      }
    }

    return [...intervals, ...timeouts];
  }

  // Detect long-running timers
  detectLongRunningTimers(thresholdMinutes = 5): Array<{
    id: number;
    type: 'interval' | 'timeout';
    runningTime: number;
    context?: string;
  }> {
    const now = new Date();
    const threshold = thresholdMinutes * 60 * 1000;
    const longRunning: Array<{
      id: number;
      type: 'interval' | 'timeout';
      runningTime: number;
      context?: string;
    }> = [];

    for (const [id, timer] of this.activeTimers.entries()) {
      const runningTime = now.getTime() - timer.createdAt.getTime();

      if (runningTime > threshold) {
        longRunning.push({
          id,
          type: timer.type,
          runningTime,
          context: timer.context,
        });
      }
    }

    return longRunning;
  }

  // Generate fix suggestions for timer leaks
  generateTimerFix(report: LeakReport): string {
    // Infer timer type from report type
    const timerType =
      report.type === 'uncleaned-interval' ? 'interval' : 'timeout';
    const cleanupFunction =
      timerType === 'interval' ? 'clearInterval' : 'clearTimeout';
    const setFunction = timerType === 'interval' ? 'setInterval' : 'setTimeout';

    // Check if it's in useEffect based on description
    const isInUseEffect = report.description.includes('useEffect');
    const isInReactComponent = report.description.includes('React component');

    if (isInUseEffect) {
      return `
// Fix: Store timer ID and add cleanup
useEffect(() => {
  const timerId = ${setFunction}(() => {
    // your code here
  }, delay);

  return () => ${cleanupFunction}(timerId);
}, [dependencies]);
      `.trim();
    }

    if (isInReactComponent) {
      return `
// Fix: Store timer ID and cleanup in component unmount
const [timerId, setTimerId] = useState(null);

useEffect(() => {
  const id = ${setFunction}(() => {
    // your code here
  }, delay);
  setTimerId(id);

  return () => {
    if (id) ${cleanupFunction}(id);
  };
}, []);
      `.trim();
    }

    return `
// Fix: Store timer ID and cleanup when appropriate
const timerId = ${setFunction}(() => {
  // your code here
}, delay);

// Later, when cleanup is needed:
${cleanupFunction}(timerId);
    `.trim();
  }

  // Cleanup all tracked timers
  cleanup(): void {
    for (const [id, timer] of this.activeTimers.entries()) {
      try {
        if (timer.type === 'interval') {
          clearInterval(id);
        } else {
          clearTimeout(id);
        }
      } catch (error) {
        console.error(`Error cleaning up timer ${id}:`, error);
      }
    }
    this.activeTimers.clear();
  }
}
