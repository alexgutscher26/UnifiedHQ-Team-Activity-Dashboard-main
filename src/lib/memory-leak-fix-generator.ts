/**
 * @fileoverview Memory Leak Fix Generator
 * 
 * This module provides the main MemoryLeakFixGenerator class that analyzes TypeScript/React code
 * and generates fixes for various types of memory leaks including:
 * - Missing useEffect cleanup functions
 * - Uncleaned event listeners
 * - Uncleaned timers (setInterval/setTimeout)
 * - Unclosed connections (EventSource/WebSocket)
 * - Uncleaned subscriptions
 * 
 * The generator uses TypeScript AST analysis to understand code structure and context,
 * then delegates to specialized fix generators for different leak types.
 * 
 * @author UnifiedHQ Memory Leak Detection System
 * @version 1.0.0
 */

import * as ts from 'typescript';
import { LeakDetectionResult, LeakType } from './memory-leak-detection-patterns';
import { createEventListenerFixGenerator } from './event-listener-fix-generator';
import { createTimerCleanupFixGenerator } from './timer-cleanup-fix-generator';
import { createConnectionCleanupFixGenerator } from './connection-cleanup-fix-generator';

/**
 * Represents a generated fix for a memory leak
 */
export interface Fix {
    /** Unique identifier for the fix */
    id: string;
    /** Type of memory leak being fixed */
    type: LeakType;
    /** File path where the fix is applied */
    file: string;
    /** Original code before the fix */
    originalCode: string;
    /** Fixed code after applying the transformation */
    fixedCode: string;
    /** Human-readable description of what the fix does */
    description: string;
    /** Confidence level of the fix (0-1, where 1 is highest confidence) */
    confidence: number;
    /** Whether the fix requires manual review before applying */
    requiresManualReview: boolean;
}

/**
 * Result of attempting to generate a fix for a memory leak
 */
export interface FixGenerationResult {
    /** Whether the fix generation was successful */
    success: boolean;
    /** The generated fix (only present if success is true) */
    fix?: Fix;
    /** Error message (only present if success is false) */
    error?: string;
}

/**
 * Represents a code transformation to be applied to source code
 */
export interface CodeTransformation {
    /** Starting position in the source code */
    start: number;
    /** Ending position in the source code */
    end: number;
    /** Replacement text to insert between start and end positions */
    replacement: string;
}

/**
 * Main class for generating fixes for memory leaks in TypeScript/React code.
 * Uses TypeScript AST analysis to detect patterns and generate appropriate cleanup code.
 * 
 * @example
 * ```typescript
 * const generator = new MemoryLeakFixGenerator(sourceCode, 'component.tsx');
 * const result = generator.generateFix(leakDetectionResult);
 * if (result.success) {
 *   console.log('Fixed code:', result.fix.fixedCode);
 * }
 * ```
 */
export class MemoryLeakFixGenerator {
    private sourceFile: ts.SourceFile;
    private sourceCode: string;
    private fileName: string;

    /**
     * Creates a new MemoryLeakFixGenerator instance
     * @param sourceCode - The source code to analyze and fix
     * @param fileName - The name of the file being processed
     */
    constructor(sourceCode: string, fileName: string) {
        this.sourceCode = sourceCode;
        this.fileName = fileName;
        this.sourceFile = ts.createSourceFile(
            fileName,
            sourceCode,
            ts.ScriptTarget.Latest,
            true
        );
    }

    /**
     * Generates a fix for the specified memory leak.
     *
     * The function evaluates the type of memory leak and delegates the fix generation to the appropriate handler based on the leak type. It handles various cases such as missing cleanup in useEffect, uncleaned event listeners, timers, and connections. If the leak type is unsupported or an error occurs during processing, it returns an error message.
     *
     * @param leak - The detected memory leak to fix.
     * @returns Result containing the generated fix or error information.
     */
    generateFix(leak: LeakDetectionResult): FixGenerationResult {
        try {
            switch (leak.type) {
                case 'missing-useeffect-cleanup':
                    return this.generateUseEffectCleanupFix(leak);
                case 'uncleaned-event-listener':
                    return this.delegateToEventListenerGenerator(leak);
                case 'uncleaned-interval':
                case 'uncleaned-timeout':
                    return this.delegateToTimerGenerator(leak);
                case 'unclosed-eventsource':
                case 'unclosed-websocket':
                case 'uncleaned-subscription':
                    return this.delegateToConnectionGenerator(leak);
                default:
                    return {
                        success: false,
                        error: `Unsupported leak type: ${leak.type}`
                    };
            }
        } catch (error) {
            return {
                success: false,
                error: `Error generating fix: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Delegates event listener leak fixes to the event listener fix generator.
     * @param leak - The event listener leak to fix.
     */
    private delegateToEventListenerGenerator(leak: LeakDetectionResult): FixGenerationResult {
        const eventListenerGenerator = createEventListenerFixGenerator(this.sourceCode, this.fileName);
        return eventListenerGenerator.generateEventListenerCleanupFix(leak);
    }

    /**
     * Delegates timer leak fixes to the specialized timer cleanup fix generator
     * @param leak - The timer leak to fix
     * @returns Fix generation result from the timer generator
     */
    private delegateToTimerGenerator(leak: LeakDetectionResult): FixGenerationResult {
        const timerGenerator = createTimerCleanupFixGenerator(this.sourceCode, this.fileName);
        return timerGenerator.generateTimerCleanupFix(leak);
    }

    /**
     * Delegates connection leak fixes to the connection cleanup fix generator.
     * @param leak - The connection leak to fix.
     */
    private delegateToConnectionGenerator(leak: LeakDetectionResult): FixGenerationResult {
        const connectionGenerator = createConnectionCleanupFixGenerator(this.sourceCode, this.fileName);
        return connectionGenerator.generateConnectionCleanupFix(leak);
    }

    /**
     * Generates a fix for useEffect hooks that are missing cleanup functions.
     *
     * This function locates the useEffect call, verifies that its callback is a function, and analyzes it for any necessary cleanup items.
     * If cleanup items are found, it generates a cleanup function, transforms the useEffect to include this cleanup, and returns the fix details.
     *
     * @param leak - The useEffect cleanup leak to fix.
     * @returns Fix generation result with cleanup function added to useEffect.
     */
    private generateUseEffectCleanupFix(leak: LeakDetectionResult): FixGenerationResult {
        const useEffectNode = this.findNodeAtPosition(leak.line, leak.column);
        if (!useEffectNode || !ts.isCallExpression(useEffectNode)) {
            return { success: false, error: 'Could not find useEffect call' };
        }

        const effectCallback = useEffectNode.arguments[0];
        if (!ts.isArrowFunction(effectCallback) && !ts.isFunctionExpression(effectCallback)) {
            return { success: false, error: 'useEffect callback is not a function' };
        }

        // Analyze what needs cleanup in the effect
        const cleanupItems = this.analyzeEffectForCleanup(effectCallback);
        if (cleanupItems.length === 0) {
            return { success: false, error: 'No cleanup items found in useEffect' };
        }

        // Generate cleanup function
        const cleanupCode = this.generateCleanupFunction(cleanupItems);

        // Transform the useEffect to include cleanup
        const transformation = this.addCleanupToUseEffect(effectCallback, cleanupCode);
        const fixedCode = this.applyTransformation(transformation);

        return {
            success: true,
            fix: {
                id: `useeffect-cleanup-${Date.now()}`,
                type: 'missing-useeffect-cleanup',
                file: this.fileName,
                originalCode: this.getNodeText(useEffectNode),
                fixedCode: fixedCode,
                description: `Added cleanup function to useEffect with ${cleanupItems.length} cleanup items`,
                confidence: 0.9,
                requiresManualReview: cleanupItems.some(item => item.requiresManualReview)
            }
        };
    }

    private generateEventListenerCleanupFix(leak: LeakDetectionResult): FixGenerationResult {
        const addEventListenerNode = this.findNodeAtPosition(leak.line, leak.column);
        if (!addEventListenerNode || !ts.isCallExpression(addEventListenerNode)) {
            return { success: false, error: 'Could not find addEventListener call' };
        }

        // Extract event listener details
        const listenerDetails = this.extractEventListenerDetails(addEventListenerNode);
        if (!listenerDetails) {
            return { success: false, error: 'Could not extract event listener details' };
        }

        // Find the containing useEffect or component
        const container = this.findContainingFunction(addEventListenerNode);
        if (!container) {
            return { success: false, error: 'Could not find containing function' };
        }

        // Generate cleanup code
        const cleanupCode = this.generateEventListenerCleanup(listenerDetails);

        // Apply the fix based on context
        let transformation: CodeTransformation;
        if (this.isInUseEffect(container)) {
            transformation = this.addCleanupToExistingUseEffect(container, cleanupCode);
        } else {
            transformation = this.wrapInUseEffectWithCleanup(addEventListenerNode, cleanupCode);
        }

        const fixedCode = this.applyTransformation(transformation);

        return {
            success: true,
            fix: {
                id: `event-listener-cleanup-${Date.now()}`,
                type: 'uncleaned-event-listener',
                file: this.fileName,
                originalCode: this.getNodeText(addEventListenerNode),
                fixedCode: fixedCode,
                description: `Added removeEventListener cleanup for ${listenerDetails.event} event`,
                confidence: 0.95,
                requiresManualReview: false
            }
        };
    }

    private generateTimerCleanupFix(leak: LeakDetectionResult): FixGenerationResult {
        const timerNode = this.findNodeAtPosition(leak.line, leak.column);
        if (!timerNode || !ts.isCallExpression(timerNode)) {
            return { success: false, error: 'Could not find timer call' };
        }

        const timerDetails = this.extractTimerDetails(timerNode);
        if (!timerDetails) {
            return { success: false, error: 'Could not extract timer details' };
        }

        // Generate cleanup code
        const cleanupCode = this.generateTimerCleanup(timerDetails);

        // Find containing function and apply fix
        const container = this.findContainingFunction(timerNode);
        if (!container) {
            return { success: false, error: 'Could not find containing function' };
        }

        let transformation: CodeTransformation;
        if (this.isInUseEffect(container)) {
            transformation = this.addCleanupToExistingUseEffect(container, cleanupCode);
        } else {
            transformation = this.wrapInUseEffectWithCleanup(timerNode, cleanupCode);
        }

        const fixedCode = this.applyTransformation(transformation);

        return {
            success: true,
            fix: {
                id: `timer-cleanup-${Date.now()}`,
                type: leak.type,
                file: this.fileName,
                originalCode: this.getNodeText(timerNode),
                fixedCode: fixedCode,
                description: `Added ${timerDetails.clearFunction} cleanup for ${timerDetails.timerFunction}`,
                confidence: 0.95,
                requiresManualReview: false
            }
        };
    }

    private generateEventSourceCleanupFix(leak: LeakDetectionResult): FixGenerationResult {
        const eventSourceNode = this.findNodeAtPosition(leak.line, leak.column);
        if (!eventSourceNode || !ts.isNewExpression(eventSourceNode)) {
            return { success: false, error: 'Could not find EventSource creation' };
        }

        // Extract variable name if assigned
        const variableName = this.extractVariableName(eventSourceNode);
        if (!variableName) {
            return { success: false, error: 'EventSource must be assigned to a variable for cleanup' };
        }

        // Generate cleanup code
        const cleanupCode = `${variableName}.close();`;

        // Find containing function and apply fix
        const container = this.findContainingFunction(eventSourceNode);
        if (!container) {
            return { success: false, error: 'Could not find containing function' };
        }

        let transformation: CodeTransformation;
        if (this.isInUseEffect(container)) {
            transformation = this.addCleanupToExistingUseEffect(container, cleanupCode);
        } else {
            transformation = this.wrapInUseEffectWithCleanup(eventSourceNode, cleanupCode);
        }

        const fixedCode = this.applyTransformation(transformation);

        return {
            success: true,
            fix: {
                id: `eventsource-cleanup-${Date.now()}`,
                type: 'unclosed-eventsource',
                file: this.fileName,
                originalCode: this.getNodeText(eventSourceNode),
                fixedCode: fixedCode,
                description: `Added EventSource.close() cleanup for ${variableName}`,
                confidence: 0.9,
                requiresManualReview: false
            }
        };
    }

    private generateWebSocketCleanupFix(leak: LeakDetectionResult): FixGenerationResult {
        const webSocketNode = this.findNodeAtPosition(leak.line, leak.column);
        if (!webSocketNode || !ts.isNewExpression(webSocketNode)) {
            return { success: false, error: 'Could not find WebSocket creation' };
        }

        // Extract variable name if assigned
        const variableName = this.extractVariableName(webSocketNode);
        if (!variableName) {
            return { success: false, error: 'WebSocket must be assigned to a variable for cleanup' };
        }

        // Generate cleanup code with readyState check
        const cleanupCode = `if (${variableName}.readyState === WebSocket.OPEN || ${variableName}.readyState === WebSocket.CONNECTING) {
      ${variableName}.close();
    }`;

        // Find containing function and apply fix
        const container = this.findContainingFunction(webSocketNode);
        if (!container) {
            return { success: false, error: 'Could not find containing function' };
        }

        let transformation: CodeTransformation;
        if (this.isInUseEffect(container)) {
            transformation = this.addCleanupToExistingUseEffect(container, cleanupCode);
        } else {
            transformation = this.wrapInUseEffectWithCleanup(webSocketNode, cleanupCode);
        }

        const fixedCode = this.applyTransformation(transformation);

        return {
            success: true,
            fix: {
                id: `websocket-cleanup-${Date.now()}`,
                type: 'unclosed-websocket',
                file: this.fileName,
                originalCode: this.getNodeText(webSocketNode),
                fixedCode: fixedCode,
                description: `Added WebSocket.close() cleanup for ${variableName}`,
                confidence: 0.9,
                requiresManualReview: false
            }
        };
    }

    /**
     * Generates a fix for subscription cleanup in a given code context.
     *
     * This function identifies a subscription call within the provided leak detection result.
     * It checks if the call is already assigned to a variable and either adds cleanup code or
     * creates a new variable for the subscription. The function then finds the containing function
     * and applies the necessary transformations to ensure proper cleanup, particularly in the context
     * of React's useEffect. Finally, it returns the result of the fix generation process.
     *
     * @param leak - The LeakDetectionResult containing information about the subscription leak.
     */
    private generateSubscriptionCleanupFix(leak: LeakDetectionResult): FixGenerationResult {
        const subscribeNode = this.findNodeAtPosition(leak.line, leak.column);
        if (!subscribeNode || !ts.isCallExpression(subscribeNode)) {
            return { success: false, error: 'Could not find subscribe call' };
        }

        // Check if subscribe call is already assigned to a variable
        const variableName = this.extractVariableName(subscribeNode);
        let transformation: CodeTransformation | undefined;
        let cleanupCode: string;

        if (variableName) {
            // Already assigned, just add cleanup
            cleanupCode = `${variableName}();`;
        } else {
            // Need to assign to variable and add cleanup
            const unsubscribeVar = 'unsubscribe';
            const subscribeText = this.getNodeText(subscribeNode);
            const newCode = `const ${unsubscribeVar} = ${subscribeText};`;
            cleanupCode = `${unsubscribeVar}();`;

            // Replace the subscribe call with assignment
            transformation = {
                start: subscribeNode.getFullStart(),
                end: subscribeNode.getEnd(),
                replacement: newCode
            };
        }

        // Find containing function and apply cleanup
        const container = this.findContainingFunction(subscribeNode);
        if (!container) {
            return { success: false, error: 'Could not find containing function' };
        }

        let finalTransformation: CodeTransformation;
        if (this.isInUseEffect(container)) {
            const cleanupTransformation = this.addCleanupToExistingUseEffect(container, cleanupCode);
            if (transformation) {
                // If we already have a transformation (from variable assignment), use it
                finalTransformation = transformation;
            } else {
                finalTransformation = cleanupTransformation;
            }
        } else {
            finalTransformation = this.wrapInUseEffectWithCleanup(subscribeNode, cleanupCode);
        }

        const fixedCode = this.applyTransformation(finalTransformation);

        return {
            success: true,
            fix: {
                id: `subscription-cleanup-${Date.now()}`,
                type: 'uncleaned-subscription',
                file: this.fileName,
                originalCode: this.getNodeText(subscribeNode),
                fixedCode: fixedCode,
                description: `Added unsubscribe cleanup for subscription`,
                confidence: 0.85,
                requiresManualReview: !variableName // Requires review if we had to create variable
            }
        };
    }

    // Helper methods for analysis and transformation
    /**
     * Finds the TypeScript AST node at the specified line and column position.
     *
     * This function calculates the position in the source file based on the provided line and column numbers.
     * It then recursively searches through the AST nodes to find the node that encompasses the specified position.
     * If a matching node is found, it is returned; otherwise, null is returned.
     *
     * @param line - Line number (1-based)
     * @param column - Column number (1-based)
     */
    private findNodeAtPosition(line: number, column: number): ts.Node | null {
        const position = this.sourceFile.getPositionOfLineAndCharacter(line - 1, column - 1);

        function findNode(node: ts.Node): ts.Node | null {
            if (node.getStart() <= position && position < node.getEnd()) {
                return ts.forEachChild(node, findNode) || node;
            }
            return null;
        }

        return findNode(this.sourceFile);
    }

    /**
     * Analyzes a useEffect callback function to identify items that need cleanup.
     *
     * The function traverses the AST of the provided effectCallback to find instances of EventSource, WebSocket,
     * addEventListener, timers (setInterval/setTimeout), and subscriptions. For each identified item, it generates
     * the appropriate cleanup code and stores it in an array, which is returned at the end of the analysis.
     *
     * @param effectCallback - The useEffect callback function to analyze.
     * @returns Array of cleanup items found in the effect.
     */
    private analyzeEffectForCleanup(effectCallback: ts.ArrowFunction | ts.FunctionExpression): CleanupItem[] {
        const cleanupItems: CleanupItem[] = [];

        const visit = (node: ts.Node) => {
            // Check for EventSource
            if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'EventSource') {
                const varName = this.extractVariableName(node);
                if (varName) {
                    cleanupItems.push({
                        type: 'eventsource',
                        code: `${varName}.close();`,
                        requiresManualReview: false
                    });
                }
            }

            // Check for WebSocket
            if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'WebSocket') {
                const varName = this.extractVariableName(node);
                if (varName) {
                    cleanupItems.push({
                        type: 'websocket',
                        code: `if (${varName}.readyState === WebSocket.OPEN || ${varName}.readyState === WebSocket.CONNECTING) { ${varName}.close(); }`,
                        requiresManualReview: false
                    });
                }
            }

            // Check for addEventListener
            if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
                ts.isIdentifier(node.expression.name) && node.expression.name.text === 'addEventListener') {
                const details = this.extractEventListenerDetails(node);
                if (details) {
                    cleanupItems.push({
                        type: 'eventlistener',
                        code: this.generateEventListenerCleanup(details),
                        requiresManualReview: false
                    });
                }
            }

            // Check for timers
            if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
                (node.expression.text === 'setInterval' || node.expression.text === 'setTimeout')) {
                const details = this.extractTimerDetails(node);
                if (details) {
                    cleanupItems.push({
                        type: 'timer',
                        code: this.generateTimerCleanup(details),
                        requiresManualReview: false
                    });
                }
            }

            // Check for subscriptions
            if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
                ts.isIdentifier(node.expression.name) && node.expression.name.text === 'subscribe') {
                const varName = this.extractVariableName(node);
                if (varName) {
                    cleanupItems.push({
                        type: 'subscription',
                        code: `${varName}();`,
                        requiresManualReview: false
                    });
                }
            }

            ts.forEachChild(node, visit);
        };

        if (effectCallback.body) {
            visit(effectCallback.body);
        }

        return cleanupItems;
    }

    /**
     * Generates a cleanup function from the specified cleanup items.
     * @param cleanupItems - Array of cleanup items to include in the function.
     * @returns String representation of the cleanup function.
     */
    private generateCleanupFunction(cleanupItems: CleanupItem[]): string {
        const cleanupCode = cleanupItems.map(item => `      ${item.code}`).join('\n');
        return `return () => {
${cleanupCode}
    };`;
    }

    /**
     * Adds cleanup code to an existing useEffect callback function
     * @param effectCallback - The useEffect callback to modify
     * @param cleanupCode - The cleanup code to add
     * @returns Code transformation to apply the cleanup
     */
    private addCleanupToUseEffect(effectCallback: ts.ArrowFunction | ts.FunctionExpression, cleanupCode: string): CodeTransformation {
        if (!effectCallback.body) {
            throw new Error('Effect callback has no body');
        }

        let insertPosition: number;
        let indentation = '    ';

        if (ts.isBlock(effectCallback.body)) {
            // Block body - insert before closing brace
            insertPosition = effectCallback.body.getEnd() - 1;
            const bodyText = this.getNodeText(effectCallback.body);
            const lines = bodyText.split('\n');
            if (lines.length > 1) {
                const lastLine = lines[lines.length - 2] || '';
                const match = lastLine.match(/^(\s*)/);
                if (match) {
                    indentation = match[1];
                }
            }
        } else {
            // Expression body - need to convert to block
            const expressionText = this.getNodeText(effectCallback.body);
            const newBody = `{
    ${expressionText};
    ${cleanupCode}
  }`;

            return {
                start: effectCallback.body.getFullStart(),
                end: effectCallback.body.getEnd(),
                replacement: newBody
            };
        }

        return {
            start: insertPosition,
            end: insertPosition,
            replacement: `\n${indentation}${cleanupCode}\n${indentation.slice(0, -2)}`
        };
    }

    /**
     * Adds cleanup code to an existing useEffect that may already have a cleanup function
     * @param container - The container node (useEffect function)
     * @param cleanupCode - The cleanup code to add
     * @returns Code transformation to add the cleanup
     */
    private addCleanupToExistingUseEffect(container: ts.Node, cleanupCode: string): CodeTransformation {
        // Find existing return statement or add new one
        let returnStatement: ts.ReturnStatement | null = null;

        const visit = (node: ts.Node) => {
            if (ts.isReturnStatement(node)) {
                returnStatement = node;
                return;
            }
            ts.forEachChild(node, visit);
        };

        visit(container);

        if (returnStatement?.expression) {
            const expression = returnStatement.expression;
            // Add to existing cleanup function
            if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
                const cleanupFunction = expression;
                if (cleanupFunction.body && ts.isBlock(cleanupFunction.body)) {
                    const insertPosition = cleanupFunction.body.getEnd() - 1;
                    return {
                        start: insertPosition,
                        end: insertPosition,
                        replacement: `\n      ${cleanupCode}\n    `
                    };
                }
            }
        }

        // Add new return statement
        const insertPosition = container.getEnd() - 1;
        return {
            start: insertPosition,
            end: insertPosition,
            replacement: `\n    ${cleanupCode.includes('return') ? cleanupCode : `return () => { ${cleanupCode} };`}\n  `
        };
    }

    /**
     * Wraps a node in a useEffect with a cleanup function.
     * @param node - The node to wrap.
     * @param cleanupCode - The cleanup code to include.
     * @returns Code transformation to wrap the node in useEffect.
     */
    private wrapInUseEffectWithCleanup(node: ts.Node, cleanupCode: string): CodeTransformation {
        const nodeText = this.getNodeText(node);
        const wrappedCode = `useEffect(() => {
    ${nodeText};
    return () => {
      ${cleanupCode}
    };
  }, []);`;

        return {
            start: node.getFullStart(),
            end: node.getEnd(),
            replacement: wrappedCode
        };
    }

    /**
     * Extracts details from an addEventListener call expression
     * @param node - The addEventListener call expression node
     * @returns Event listener details or null if extraction fails
     */
    private extractEventListenerDetails(node: ts.CallExpression): EventListenerDetails | null {
        if (node.arguments.length < 2) return null;

        const target = ts.isPropertyAccessExpression(node.expression) ?
            this.getNodeText(node.expression.expression) : 'element';

        const event = ts.isStringLiteral(node.arguments[0]) ?
            node.arguments[0].text : this.getNodeText(node.arguments[0]);

        const handler = this.getNodeText(node.arguments[1]);
        const options = node.arguments[2] ? this.getNodeText(node.arguments[2]) : undefined;

        return { target, event, handler, options };
    }

    /**
     * Generates removeEventListener cleanup code from event listener details.
     * @param details - The event listener details.
     * @returns The cleanup code string.
     */
    private generateEventListenerCleanup(details: EventListenerDetails): string {
        const optionsStr = details.options ? `, ${details.options}` : '';
        return `${details.target}.removeEventListener('${details.event}', ${details.handler}${optionsStr});`;
    }

    /**
     * Extracts details from a timer function call (setInterval/setTimeout).
     *
     * This function checks if the provided node is an identifier and retrieves the timer function name.
     * It determines the corresponding clear function based on the timer function type and extracts the
     * variable name associated with the timer call. If the variable name is not found, it defaults to 'timer'.
     *
     * @param node - The timer call expression node
     */
    private extractTimerDetails(node: ts.CallExpression): TimerDetails | null {
        if (!ts.isIdentifier(node.expression)) return null;

        const timerFunction = node.expression.text;
        const clearFunction = timerFunction === 'setInterval' ? 'clearInterval' : 'clearTimeout';
        const variableName = this.extractVariableName(node);

        return {
            timerFunction,
            clearFunction,
            variableName: variableName || 'timer'
        };
    }

    /**
     * Generates timer cleanup code from timer details
     * @param details - The timer details
     * @returns The cleanup code string
     */
    private generateTimerCleanup(details: TimerDetails): string {
        return `${details.clearFunction}(${details.variableName});`;
    }

    /**
     * Extracts the variable name that a node is assigned to.
     *
     * This function traverses the parent nodes of the given AST node to find a variable declaration or a binary expression with an assignment operator.
     * If a variable declaration is found, it returns the name of the variable. If a binary expression is encountered, it checks if the left side is an identifier and returns its text.
     * If no variable name is found, it returns null.
     *
     * @param node - The AST node to check for variable assignment.
     */
    private extractVariableName(node: ts.Node): string | null {
        let current = node.parent;

        while (current) {
            if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
                return current.name.text;
            }
            if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                if (ts.isIdentifier(current.left)) {
                    return current.left.text;
                }
            }
            current = current.parent;
        }

        return null;
    }

    /**
     * Finds the containing function for a given AST node.
     *
     * This function traverses the parent nodes of the provided AST node to locate the nearest function declaration, arrow function, function expression, or method declaration. If such a function is found, it is returned; otherwise, the function returns null. The traversal continues until a function node is identified or there are no more parent nodes to check.
     *
     * @param node - The AST node to find the containing function for.
     */
    private findContainingFunction(node: ts.Node): ts.Node | null {
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

    /**
     * Determines if a given container node is part of a useEffect call.
     *
     * This function traverses the parent nodes of the provided container to check
     * if any of them is a call expression that invokes 'useEffect'. It continues
     * this traversal until it either finds a matching call or reaches the root of
     * the node tree, returning true if found, otherwise false.
     *
     * @param container - The container node to check.
     */
    private isInUseEffect(container: ts.Node): boolean {
        // Check if the container is a useEffect callback
        let current = container.parent;
        while (current) {
            if (ts.isCallExpression(current) &&
                ts.isIdentifier(current.expression) &&
                current.expression.text === 'useEffect') {
                return true;
            }
            current = current.parent;
        }
        return false;
    }

    /**
     * Applies a code transformation to the source code.
     * @param transformation - The transformation to apply.
     */
    private applyTransformation(transformation: CodeTransformation): string {
        const before = this.sourceCode.substring(0, transformation.start);
        const after = this.sourceCode.substring(transformation.end);
        return before + transformation.replacement + after;
    }

    /**
     * Gets the trimmed text content of a TypeScript AST node.
     * @param node - The AST node to get text from.
     */
    private getNodeText(node: ts.Node): string {
        return this.sourceCode.substring(node.getFullStart(), node.getEnd()).trim();
    }
}

// Supporting interfaces
/**
 * Represents an item that needs cleanup in a useEffect
 */
interface CleanupItem {
    /** Type of cleanup item */
    type: 'eventsource' | 'websocket' | 'eventlistener' | 'timer' | 'subscription';
    /** Cleanup code to execute */
    code: string;
    /** Whether this cleanup requires manual review */
    requiresManualReview: boolean;
}

/**
 * Details extracted from an addEventListener call
 */
interface EventListenerDetails {
    /** The target element or object */
    target: string;
    /** The event name */
    event: string;
    /** The event handler function */
    handler: string;
    /** Optional event listener options */
    options?: string;
}

/**
 * Details extracted from a timer function call (setInterval/setTimeout)
 */
interface TimerDetails {
    /** The timer function name (setInterval or setTimeout) */
    timerFunction: string;
    /** The corresponding clear function name (clearInterval or clearTimeout) */
    clearFunction: string;
    /** The variable name the timer is assigned to */
    variableName: string;
}

// Factory function
/**
 * Creates a new MemoryLeakFixGenerator instance.
 * @param sourceCode - The source code to analyze and fix.
 * @param fileName - The name of the file being processed.
 */
export function createMemoryLeakFixGenerator(sourceCode: string, fileName: string): MemoryLeakFixGenerator {
    return new MemoryLeakFixGenerator(sourceCode, fileName);
}