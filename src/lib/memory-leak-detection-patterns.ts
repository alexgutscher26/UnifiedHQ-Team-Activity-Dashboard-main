import * as ts from 'typescript';

export interface LeakDetectionResult {
    type: LeakType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    file: string;
    line: number;
    column: number;
    description: string;
    suggestedFix?: string;
    codeSnippet: string;
}

export type LeakType =
    | 'missing-useeffect-cleanup'
    | 'uncleaned-event-listener'
    | 'uncleaned-interval'
    | 'uncleaned-timeout'
    | 'uncleaned-subscription'
    | 'unclosed-eventsource'
    | 'unclosed-websocket'
    | 'memory-accumulation'
    | 'circular-reference';

export class SubscriptionLeakDetector {
    private sourceFile: ts.SourceFile;
    private fileName: string;
    private results: LeakDetectionResult[] = [];

    constructor(sourceCode: string, fileName: string) {
        this.fileName = fileName;
        this.sourceFile = ts.createSourceFile(
            fileName,
            sourceCode,
            ts.ScriptTarget.Latest,
            true
        );
    }

    detectLeaks(): LeakDetectionResult[] {
        this.results = [];
        this.visitNode(this.sourceFile);
        return this.results;
    }

    private visitNode(node: ts.Node) {
        // Detect EventSource leaks
        this.detectEventSourceLeaks(node);

        // Detect WebSocket leaks
        this.detectWebSocketLeaks(node);

        // Detect subscription pattern leaks
        this.detectSubscriptionLeaks(node);

        // Detect useEffect cleanup issues
        this.detectUseEffectCleanupLeaks(node);

        ts.forEachChild(node, child => this.visitNode(child));
    }

    private detectEventSourceLeaks(node: ts.Node) {
        // Detect new EventSource() without proper cleanup
        if (ts.isNewExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'EventSource') {

            const hasCleanup = this.hasEventSourceCleanup(node);
            if (!hasCleanup) {
                const position = this.sourceFile.getLineAndCharacterOfPosition(node.getStart());
                this.results.push({
                    type: 'unclosed-eventsource',
                    severity: 'high',
                    file: this.fileName,
                    line: position.line + 1,
                    column: position.character + 1,
                    description: 'EventSource created without proper cleanup. This can cause memory leaks.',
                    suggestedFix: 'Add eventSource.close() in useEffect cleanup or component unmount',
                    codeSnippet: this.getCodeSnippet(node)
                });
            }
        }
    }

    private detectWebSocketLeaks(node: ts.Node) {
        // Detect new WebSocket() without proper cleanup
        if (ts.isNewExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'WebSocket') {

            const hasCleanup = this.hasWebSocketCleanup(node);
            if (!hasCleanup) {
                const position = this.sourceFile.getLineAndCharacterOfPosition(node.getStart());
                this.results.push({
                    type: 'unclosed-websocket',
                    severity: 'high',
                    file: this.fileName,
                    line: position.line + 1,
                    column: position.character + 1,
                    description: 'WebSocket created without proper cleanup. This can cause memory leaks.',
                    suggestedFix: 'Add webSocket.close() in useEffect cleanup or component unmount',
                    codeSnippet: this.getCodeSnippet(node)
                });
            }
        }
    }

    private detectSubscriptionLeaks(node: ts.Node) {
        // Detect .subscribe() calls without unsubscribe
        if (ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.name) &&
            node.expression.name.text === 'subscribe') {

            const hasUnsubscribe = this.hasUnsubscribePattern(node);
            if (!hasUnsubscribe) {
                const position = this.sourceFile.getLineAndCharacterOfPosition(node.getStart());
                this.results.push({
                    type: 'uncleaned-subscription',
                    severity: 'medium',
                    file: this.fileName,
                    line: position.line + 1,
                    column: position.character + 1,
                    description: 'Subscription created without unsubscribe. This can cause memory leaks.',
                    suggestedFix: 'Store the unsubscribe function and call it in useEffect cleanup',
                    codeSnippet: this.getCodeSnippet(node)
                });
            }
        }
    }

    private detectUseEffectCleanupLeaks(node: ts.Node) {
        // Detect useEffect with subscriptions but no cleanup
        if (ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'useEffect') {

            const effectCallback = node.arguments[0];
            if (ts.isArrowFunction(effectCallback) || ts.isFunctionExpression(effectCallback)) {
                const hasSubscriptions = this.hasSubscriptionsInEffect(effectCallback);
                const hasCleanup = this.hasCleanupInEffect(effectCallback);

                if (hasSubscriptions && !hasCleanup) {
                    const position = this.sourceFile.getLineAndCharacterOfPosition(node.getStart());
                    this.results.push({
                        type: 'missing-useeffect-cleanup',
                        severity: 'high',
                        file: this.fileName,
                        line: position.line + 1,
                        column: position.character + 1,
                        description: 'useEffect contains subscriptions but no cleanup function. This can cause memory leaks.',
                        suggestedFix: 'Add return statement with cleanup function in useEffect',
                        codeSnippet: this.getCodeSnippet(node)
                    });
                }
            }
        }
    }

    private hasEventSourceCleanup(node: ts.Node): boolean {
        // Look for .close() calls in the same scope or cleanup functions
        const parent = this.findParentFunction(node);
        if (!parent) return false;

        return this.hasMethodCall(parent, 'close') || this.hasCleanupReturn(parent);
    }

    private hasWebSocketCleanup(node: ts.Node): boolean {
        // Look for .close() calls in the same scope or cleanup functions
        const parent = this.findParentFunction(node);
        if (!parent) return false;

        return this.hasMethodCall(parent, 'close') || this.hasCleanupReturn(parent);
    }

    private hasUnsubscribePattern(node: ts.Node): boolean {
        // Look for unsubscribe calls or cleanup patterns
        const parent = this.findParentFunction(node);
        if (!parent) return false;

        return this.hasMethodCall(parent, 'unsubscribe') ||
            this.hasVariableAssignment(parent, node) ||
            this.hasCleanupReturn(parent);
    }

    private hasSubscriptionsInEffect(effectFunction: ts.ArrowFunction | ts.FunctionExpression): boolean {
        let hasSubscriptions = false;

        const visit = (node: ts.Node) => {
            // Check for EventSource, WebSocket, or subscribe calls
            if (ts.isNewExpression(node)) {
                if (ts.isIdentifier(node.expression) &&
                    (node.expression.text === 'EventSource' || node.expression.text === 'WebSocket')) {
                    hasSubscriptions = true;
                }
            }

            if (ts.isCallExpression(node) &&
                ts.isPropertyAccessExpression(node.expression) &&
                ts.isIdentifier(node.expression.name) &&
                node.expression.name.text === 'subscribe') {
                hasSubscriptions = true;
            }

            // Check for addEventListener
            if (ts.isCallExpression(node) &&
                ts.isPropertyAccessExpression(node.expression) &&
                ts.isIdentifier(node.expression.name) &&
                node.expression.name.text === 'addEventListener') {
                hasSubscriptions = true;
            }

            // Check for setInterval/setTimeout
            if (ts.isCallExpression(node) &&
                ts.isIdentifier(node.expression) &&
                (node.expression.text === 'setInterval' || node.expression.text === 'setTimeout')) {
                hasSubscriptions = true;
            }

            ts.forEachChild(node, visit);
        };

        if (effectFunction.body) {
            visit(effectFunction.body);
        }

        return hasSubscriptions;
    }

    private hasCleanupInEffect(effectFunction: ts.ArrowFunction | ts.FunctionExpression): boolean {
        let hasCleanup = false;

        const visit = (node: ts.Node) => {
            // Look for return statements that return a function
            if (ts.isReturnStatement(node) && node.expression) {
                if (ts.isArrowFunction(node.expression) ||
                    ts.isFunctionExpression(node.expression) ||
                    ts.isIdentifier(node.expression)) {
                    hasCleanup = true;
                }
            }

            ts.forEachChild(node, visit);
        };

        if (effectFunction.body) {
            visit(effectFunction.body);
        }

        return hasCleanup;
    }

    private findParentFunction(node: ts.Node): ts.Node | null {
        let current = node.parent;
        while (current) {
            if (ts.isFunctionDeclaration(current) ||
                ts.isArrowFunction(current) ||
                ts.isFunctionExpression(current) ||
                ts.isMethodDeclaration(current)) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    private hasMethodCall(parent: ts.Node, methodName: string): boolean {
        let hasCall = false;

        const visit = (node: ts.Node) => {
            if (ts.isCallExpression(node) &&
                ts.isPropertyAccessExpression(node.expression) &&
                ts.isIdentifier(node.expression.name) &&
                node.expression.name.text === methodName) {
                hasCall = true;
            }
            ts.forEachChild(node, visit);
        };

        visit(parent);
        return hasCall;
    }

    private hasVariableAssignment(parent: ts.Node, subscribeNode: ts.Node): boolean {
        // Check if the subscribe call is assigned to a variable
        let current = subscribeNode.parent;
        while (current && current !== parent) {
            if (ts.isVariableDeclaration(current) || ts.isBinaryExpression(current)) {
                return true;
            }
            current = current.parent;
        }
        return false;
    }

    private hasCleanupReturn(parent: ts.Node): boolean {
        let hasReturn = false;

        const visit = (node: ts.Node) => {
            if (ts.isReturnStatement(node) && node.expression) {
                hasReturn = true;
            }
            ts.forEachChild(node, visit);
        };

        visit(parent);
        return hasReturn;
    }

    private getCodeSnippet(node: ts.Node): string {
        const start = node.getFullStart();
        const end = node.getEnd();
        return this.sourceFile.text.substring(start, end).trim();
    }
}

// Factory function to create detector
export function createSubscriptionLeakDetector(sourceCode: string, fileName: string): SubscriptionLeakDetector {
    return new SubscriptionLeakDetector(sourceCode, fileName);
}

// Utility function to scan a file for subscription leaks
export async function scanFileForSubscriptionLeaks(filePath: string): Promise<LeakDetectionResult[]> {
    try {
        const fs = await import('fs/promises');
        const sourceCode = await fs.readFile(filePath, 'utf-8');
        const detector = createSubscriptionLeakDetector(sourceCode, filePath);
        return detector.detectLeaks();
    } catch (error) {
        console.error(`Error scanning file ${filePath}:`, error);
        return [];
    }
}

// Utility function to scan multiple files
export async function scanFilesForSubscriptionLeaks(filePaths: string[]): Promise<LeakDetectionResult[]> {
    const allResults: LeakDetectionResult[] = [];

    for (const filePath of filePaths) {
        const results = await scanFileForSubscriptionLeaks(filePath);
        allResults.push(...results);
    }

    return allResults;
}