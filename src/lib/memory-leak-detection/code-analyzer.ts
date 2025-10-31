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
     * Analyzes code for memory leaks and returns the analysis results.
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
     * Analyzes AST nodes for useEffect hooks and component lifecycle methods.
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
     * Checks if the node is a useEffect call.
     */
    private isUseEffectCall(node: ts.Node): boolean {
        return ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'useEffect';
    }

    /**
     * Checks if the given node is a componentDidMount method.
     */
    private isComponentDidMount(node: ts.Node): boolean {
        return ts.isMethodDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.name.text === 'componentDidMount';
    }

    /**
     * Analyzes useEffect for potential memory leaks and cleanup actions.
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
        /**
         * Analyzes a TypeScript AST node for potential resource leaks.
         *
         * The function checks if the node represents various constructs that may lead to resource leaks, such as event listeners, intervals, timeouts, EventSources, WebSockets, subscriptions, and AbortControllers. For each identified construct, it records the type, line, column, and a description of the issue in the `potentialLeaks` map, along with suggested fixes for proper cleanup. The function recursively visits child nodes to ensure comprehensive analysis.
         *
         * @param node - The TypeScript AST node to analyze for potential leaks.
         */
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
        /**
         * Processes a TypeScript AST node to analyze return statements.
         *
         * If the node is a return statement with an expression that is either an arrow function or a function expression,
         * it invokes the analyzeCleanupActions method to handle cleanup actions. The function then recursively visits
         * all child nodes of the current node to ensure comprehensive analysis.
         *
         * @param node - The TypeScript AST node to be visited.
         */
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
     * Analyze cleanup actions in a cleanup function.
     *
     * This function traverses the provided cleanup function's AST nodes to identify and record various cleanup actions, such as removing event listeners, clearing intervals and timeouts, closing connections, unsubscribing from subscriptions, and aborting controllers. It utilizes helper methods to determine the type of cleanup required and stores the results in the provided `cleanupActions` array while tracking found cleanups in the `foundCleanups` set.
     *
     * @param cleanupFn - The cleanup function represented as an ArrowFunction or FunctionExpression.
     * @param foundCleanups - A Set to track the types of cleanups that have been identified.
     * @param cleanupActions - An array to store the details of each cleanup action identified during the analysis.
     */
    private analyzeCleanupActions(
        cleanupFn: ts.ArrowFunction | ts.FunctionExpression,
        foundCleanups: Set<string>,
        cleanupActions: CleanupAction[]
    ): void {
        /**
         * Processes a given AST node to identify and record cleanup actions.
         * The function checks for various types of cleanup calls such as removing event listeners, clearing intervals,
         * clearing timeouts, closing connections, unsubscribing, and aborting controllers. For each identified call,
         * it adds the corresponding cleanup action to the `cleanupActions` array along with the position of the node.
         *
         * @param node - The AST node to be visited and processed for cleanup actions.
         */
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
     * Check if cleanup matches the memory leak type.
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
     * Calculate memory safety score (0-100).
     *
     * This function evaluates the memory safety score based on the number of memory leaks and cleanup actions.
     * It deducts points for errors and warnings found in the leaks, where each error reduces the score by 25 points
     * and each warning by 10 points. Additionally, it adds points for each cleanup action performed, contributing
     * 5 points per action. The final score is constrained between 0 and 100.
     *
     * @param {MemoryLeak[]} leaks - An array of memory leaks to evaluate.
     * @param {CleanupAction[]} cleanupActions - An array of cleanup actions taken.
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
     * Retrieves the line and column position of a given node.
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

    /**
     * Checks if the given node is a call to removeEventListener.
     */
    private isRemoveEventListenerCall(node: ts.Node): boolean {
        return ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.name) &&
            node.expression.name.text === 'removeEventListener';
    }

    /**
     * Checks if the given node is a call to setInterval.
     */
    private isSetIntervalCall(node: ts.Node): boolean {
        return ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'setInterval';
    }

    /**
     * Checks if the given node is a call to clearInterval.
     */
    private isClearIntervalCall(node: ts.Node): boolean {
        return ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'clearInterval';
    }

    /**
     * Checks if the given node is a call to setTimeout.
     */
    private isSetTimeoutCall(node: ts.Node): boolean {
        return ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'setTimeout';
    }

    /**
     * Checks if the given node is a call to clearTimeout.
     */
    private isClearTimeoutCall(node: ts.Node): boolean {
        return ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'clearTimeout';
    }

    /**
     * Checks if the given node is a creation of an EventSource.
     */
    private isEventSourceCreation(node: ts.Node): boolean {
        return ts.isNewExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'EventSource';
    }

    /**
     * Checks if the given node represents a WebSocket creation.
     */
    private isWebSocketCreation(node: ts.Node): boolean {
        return ts.isNewExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'WebSocket';
    }

    /**
     * Checks if the given node is a new AbortController instance.
     */
    private isAbortControllerCreation(node: ts.Node): boolean {
        return ts.isNewExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'AbortController';
    }

    /**
     * Checks if the given node is a subscription call expression.
     */
    private isSubscriptionCall(node: ts.Node): boolean {
        return ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.name) &&
            node.expression.name.text === 'subscribe';
    }

    /**
     * Checks if the given node is a call expression to the 'close' method.
     */
    private isCloseCall(node: ts.Node): boolean {
        return ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.name) &&
            node.expression.name.text === 'close';
    }

    /**
     * Checks if the given node is a call to the 'unsubscribe' method.
     */
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