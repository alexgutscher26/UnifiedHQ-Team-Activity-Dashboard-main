/**
 * Advanced Code Analyzer for Memory Leak Detection
 * 
 * Uses TypeScript AST to analyze React components and hooks for potential memory leaks.
 * Provides detailed analysis and suggestions for fixing memory leaks.
 */

import * as ts from 'typescript';

export interface MemoryLeakAnalysis {
    hasMemoryLeaks: boolean;
    leaks: MemoryLeak[];
    cleanupActions: CleanupAction[];
    suggestions: string[];
    score: number; // 0-100, higher is better
}

export interface MemoryLeak {
    type: string;
    line: number;
    column: number;
    description: string;
    severity: 'error' | 'warning' | 'info';
    suggestedFix: string;
}

export interface CleanupAction {
    type: string;
    line: number;
    column: number;
    description: string;
}

export class CodeAnalyzer {
    private sourceFile: ts.SourceFile | null = null;

    /**
     * Analyze code for memory leaks
     */
    analyzeCode(code: string, fileName: string = 'component.tsx'): MemoryLeakAnalysis {
        try {
            this.sourceFile = ts.createSourceFile(
                fileName,
                code,
                ts.ScriptTarget.Latest,
                true,
                ts.ScriptKind.TSX
            );

            const leaks: MemoryLeak[] = [];
            const cleanupActions: CleanupAction[] = [];

            this.analyzeNode(this.sourceFile, leaks, cleanupActions);

            const suggestions = this.generateSuggestions(leaks, cleanupActions);
            const score = this.calculateScore(leaks, cleanupActions);

            return {
                hasMemoryLeaks: leaks.length > 0,
                leaks,
                cleanupActions,
                suggestions,
                score,
            };

        } catch (error) {
            console.error('Code analysis failed:', error);
            return {
                hasMemoryLeaks: false,
                leaks: [],
                cleanupActions: [],
                suggestions: ['Code analysis failed - please check syntax'],
                score: 0,
            };
        }
    }

    /**
     * Recursively analyze AST nodes
     */
    private analyzeNode(node: ts.Node, leaks: MemoryLeak[], cleanupActions: CleanupAction[]): void {
        // Analyze useEffect hooks
        if (this.isUseEffectCall(node)) {
            this.analyzeUseEffect(node as ts.CallExpression, leaks, cleanupActions);
        }

        // Analyze component lifecycle methods
        if (this.isComponentDidMount(node)) {
            this.analyzeComponentDidMount(node, leaks, cleanupActions);
        }

        // Continue traversing
        ts.forEachChild(node, (child) => this.analyzeNode(child, leaks, cleanupActions));
    }

    /**
     * Check if node is a useEffect call
     */
    private isUseEffectCall(node: ts.Node): boolean {
        return ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'useEffect';
    }

    /**
     * Check if node is componentDidMount
     */
    private isComponentDidMount(node: ts.Node): boolean {
        return ts.isMethodDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.name.text === 'componentDidMount';
    }

    /**
     * Analyze useEffect for memory leaks
     */
    private analyzeUseEffect(
        useEffectCall: ts.CallExpression,
        leaks: MemoryLeak[],
        cleanupActions: CleanupAction[]
    ): void {
        if (useEffectCall.arguments.length === 0) return;

        const callback = useEffectCall.arguments[0];
        const potentialLeaks = new Map<string, MemoryLeak>();
        const foundCleanups = new Set<string>();

        // Analyze the callback function
        this.analyzeCallback(callback, potentialLeaks);

        // Look for cleanup function (return statement)
        this.findCleanupFunction(callback, foundCleanups, cleanupActions);

        // Check for unmatched leaks
        potentialLeaks.forEach((leak, key) => {
            if (!this.hasMatchingCleanup(key, foundCleanups)) {
                leaks.push(leak);
            }
        });
    }

    /**
     * Analyze callback function for potential memory leaks
     */
    private analyzeCallback(callback: ts.Expression, potentialLeaks: Map<string, MemoryLeak>): void {
        const visit = (node: ts.Node) => {
            const position = this.getPosition(node);

            // Check for addEventListener
            if (this.isAddEventListenerCall(node)) {
                potentialLeaks.set('addEventListener', {
                    type: 'addEventListener',
                    line: position.line,
                    column: position.column,
                    description: 'Event listener added without cleanup',
                    severity: 'error',
                    suggestedFix: 'Add removeEventListener in cleanup function',
                });
            }

            // Check for setInterval
            if (this.isSetIntervalCall(node)) {
                potentialLeaks.set('setInterval', {
                    type: 'setInterval',
                    line: position.line,
                    column: position.column,
                    description: 'Interval created without cleanup',
                    severity: 'error',
                    suggestedFix: 'Add clearInterval in cleanup function',
                });
            }

            // Check for setTimeout
            if (this.isSetTimeoutCall(node)) {
                potentialLeaks.set('setTimeout', {
                    type: 'setTimeout',
                    line: position.line,
                    column: position.column,
                    description: 'Timeout created without cleanup',
                    severity: 'warning',
                    suggestedFix: 'Add clearTimeout in cleanup function',
                });
            }

            // Check for EventSource
            if (this.isEventSourceCreation(node)) {
                potentialLeaks.set('EventSource', {
                    type: 'EventSource',
                    line: position.line,
                    column: position.column,
                    description: 'EventSource created without cleanup',
                    severity: 'error',
                    suggestedFix: 'Add eventSource.close() in cleanup function',
                });
            }

            // Check for WebSocket
            if (this.isWebSocketCreation(node)) {
                potentialLeaks.set('WebSocket', {
                    type: 'WebSocket',
                    line: position.line,
                    column: position.column,
                    description: 'WebSocket created without cleanup',
                    severity: 'error',
                    suggestedFix: 'Add webSocket.close() in cleanup function',
                });
            }

            // Check for subscriptions
            if (this.isSubscriptionCall(node)) {
                potentialLeaks.set('subscription', {
                    type: 'subscription',
                    line: position.line,
                    column: position.column,
                    description: 'Subscription created without cleanup',
                    severity: 'error',
                    suggestedFix: 'Add subscription.unsubscribe() in cleanup function',
                });
            }

            // Check for AbortController
            if (this.isAbortControllerCreation(node)) {
                potentialLeaks.set('AbortController', {
                    type: 'AbortController',
                    line: position.line,
                    column: position.column,
                    description: 'AbortController created without cleanup',
                    severity: 'warning',
                    suggestedFix: 'Add controller.abort() in cleanup function',
                });
            }

            ts.forEachChild(node, visit);
        };

        visit(callback);
    }

    /**
     * Find cleanup function and analyze cleanup actions
     */
    private findCleanupFunction(
        callback: ts.Expression,
        foundCleanups: Set<string>,
        cleanupActions: CleanupAction[]
    ): void {
        const visit = (node: ts.Node) => {
            if (ts.isReturnStatement(node) && node.expression) {
                if (ts.isArrowFunction(node.expression) || ts.isFunctionExpression(node.expression)) {
                    this.analyzeCleanupActions(node.expression, foundCleanups, cleanupActions);
                }
            }
            ts.forEachChild(node, visit);
        };

        visit(callback);
    }

    /**
     * Analyze cleanup actions in cleanup function
     */
    private analyzeCleanupActions(
        cleanupFn: ts.ArrowFunction | ts.FunctionExpression,
        foundCleanups: Set<string>,
        cleanupActions: CleanupAction[]
    ): void {
        const visit = (node: ts.Node) => {
            const position = this.getPosition(node);

            if (this.isRemoveEventListenerCall(node)) {
                foundCleanups.add('addEventListener');
                cleanupActions.push({
                    type: 'removeEventListener',
                    line: position.line,
                    column: position.column,
                    description: 'Event listener cleanup',
                });
            }

            if (this.isClearIntervalCall(node)) {
                foundCleanups.add('setInterval');
                cleanupActions.push({
                    type: 'clearInterval',
                    line: position.line,
                    column: position.column,
                    description: 'Interval cleanup',
                });
            }

            if (this.isClearTimeoutCall(node)) {
                foundCleanups.add('setTimeout');
                cleanupActions.push({
                    type: 'clearTimeout',
                    line: position.line,
                    column: position.column,
                    description: 'Timeout cleanup',
                });
            }

            if (this.isCloseCall(node)) {
                foundCleanups.add('EventSource');
                foundCleanups.add('WebSocket');
                cleanupActions.push({
                    type: 'close',
                    line: position.line,
                    column: position.column,
                    description: 'Connection cleanup',
                });
            }

            if (this.isUnsubscribeCall(node)) {
                foundCleanups.add('subscription');
                cleanupActions.push({
                    type: 'unsubscribe',
                    line: position.line,
                    column: position.column,
                    description: 'Subscription cleanup',
                });
            }

            if (this.isAbortCall(node)) {
                foundCleanups.add('AbortController');
                cleanupActions.push({
                    type: 'abort',
                    line: position.line,
                    column: position.column,
                    description: 'AbortController cleanup',
                });
            }

            ts.forEachChild(node, visit);
        };

        visit(cleanupFn);
    }

    /**
     * Check if cleanup matches the memory leak type
     */
    private hasMatchingCleanup(leakType: string, cleanups: Set<string>): boolean {
        return cleanups.has(leakType);
    }

    /**
     * Generate suggestions based on analysis
     */
    private generateSuggestions(leaks: MemoryLeak[], cleanupActions: CleanupAction[]): string[] {
        const suggestions: string[] = [];

        if (leaks.length === 0) {
            suggestions.push('✅ No memory leaks detected - great job!');
        } else {
            suggestions.push(`⚠️ Found ${leaks.length} potential memory leak(s)`);

            leaks.forEach(leak => {
                suggestions.push(`• ${leak.suggestedFix}`);
            });

            if (cleanupActions.length === 0) {
                suggestions.push('💡 Add a cleanup function that returns from useEffect');
            }
        }

        return suggestions;
    }

    /**
     * Calculate memory safety score (0-100)
     */
    private calculateScore(leaks: MemoryLeak[], cleanupActions: CleanupAction[]): number {
        const totalIssues = leaks.length;
        const cleanupCount = cleanupActions.length;

        if (totalIssues === 0) return 100;

        const errorCount = leaks.filter(l => l.severity === 'error').length;
        const warningCount = leaks.filter(l => l.severity === 'warning').length;

        // Deduct points for errors and warnings
        let score = 100;
        score -= errorCount * 25; // 25 points per error
        score -= warningCount * 10; // 10 points per warning

        // Add points for cleanup actions
        score += cleanupCount * 5; // 5 points per cleanup action

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Get position information for a node
     */
    private getPosition(node: ts.Node): { line: number; column: number } {
        if (!this.sourceFile) return { line: 0, column: 0 };

        const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(node.getStart());
        return { line: line + 1, column: character + 1 };
    }

    // Helper methods for detecting specific patterns
    private isAddEventListenerCall(node: ts.Node): boolean {
        return ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.name) &&
            node.expression.name.text === 'addEventListener';
    }

    private isRemoveEventListenerCall(node: ts.Node): boolean {
        return ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.name) &&
            node.expression.name.text === 'removeEventListener';
    }

    private isSetIntervalCall(node: ts.Node): boolean {
        return ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'setInterval';
    }

    private isClearIntervalCall(node: ts.Node): boolean {
        return ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'clearInterval';
    }

    private isSetTimeoutCall(node: ts.Node): boolean {
        return ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'setTimeout';
    }

    private isClearTimeoutCall(node: ts.Node): boolean {
        return ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'clearTimeout';
    }

    private isEventSourceCreation(node: ts.Node): boolean {
        return ts.isNewExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'EventSource';
    }

    private isWebSocketCreation(node: ts.Node): boolean {
        return ts.isNewExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'WebSocket';
    }

    private isAbortControllerCreation(node: ts.Node): boolean {
        return ts.isNewExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'AbortController';
    }

    private isSubscriptionCall(node: ts.Node): boolean {
        return ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.name) &&
            node.expression.name.text === 'subscribe';
    }

    private isCloseCall(node: ts.Node): boolean {
        return ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.name) &&
            node.expression.name.text === 'close';
    }

    private isUnsubscribeCall(node: ts.Node): boolean {
        return ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.name) &&
            node.expression.name.text === 'unsubscribe';
    }

    private isAbortCall(node: ts.Node): boolean {
        return ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.name) &&
            node.expression.name.text === 'abort';
    }

    private analyzeComponentDidMount(node: ts.Node, leaks: MemoryLeak[], cleanupActions: CleanupAction[]): void {
        // TODO: Implement class component analysis
        // This would analyze componentDidMount and check for componentWillUnmount cleanup
    }
}

/**
 * Convenience function for quick analysis
 */
export function analyzeCodeForMemoryLeaks(code: string, fileName?: string): MemoryLeakAnalysis {
    const analyzer = new CodeAnalyzer();
    return analyzer.analyzeCode(code, fileName);
}

/**
 * Generate a detailed report
 */
export function generateMemoryLeakReport(analysis: MemoryLeakAnalysis): string {
    const lines: string[] = [];

    lines.push('🔍 Memory Leak Analysis Report');
    lines.push('='.repeat(40));
    lines.push(`Score: ${analysis.score}/100`);
    lines.push(`Status: ${analysis.hasMemoryLeaks ? '❌ Issues Found' : '✅ Clean'}`);
    lines.push('');

    if (analysis.leaks.length > 0) {
        lines.push('🚨 Memory Leaks Detected:');
        analysis.leaks.forEach((leak, index) => {
            lines.push(`${index + 1}. ${leak.description} (Line ${leak.line})`);
            lines.push(`   Fix: ${leak.suggestedFix}`);
        });
        lines.push('');
    }

    if (analysis.cleanupActions.length > 0) {
        lines.push('✅ Cleanup Actions Found:');
        analysis.cleanupActions.forEach((action, index) => {
            lines.push(`${index + 1}. ${action.description} (Line ${action.line})`);
        });
        lines.push('');
    }

    lines.push('💡 Suggestions:');
    analysis.suggestions.forEach(suggestion => {
        lines.push(`• ${suggestion}`);
    });

    return lines.join('\n');
}