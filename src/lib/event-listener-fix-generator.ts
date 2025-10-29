import * as ts from 'typescript';
import {
  Fix,
  FixGenerationResult,
  CodeTransformation,
} from './memory-leak-fix-generator';
import { LeakDetectionResult } from './memory-leak-detection-patterns';

export interface EventListenerPattern {
  target: string;
  event: string;
  handler: string;
  options?: string;
  handlerType: 'inline' | 'reference' | 'arrow';
  isMediaQuery?: boolean;
  isWindowEvent?: boolean;
  isDocumentEvent?: boolean;
}

export class EventListenerFixGenerator {
  private sourceFile: ts.SourceFile;
  private sourceCode: string;
  private fileName: string;

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

  generateEventListenerCleanupFix(
    leak: LeakDetectionResult
  ): FixGenerationResult {
    try {
      const addEventListenerNode = this.findNodeAtPosition(
        leak.line,
        leak.column
      );
      if (!addEventListenerNode || !ts.isCallExpression(addEventListenerNode)) {
        return {
          success: false,
          error: 'Could not find addEventListener call',
        };
      }

      // Analyze the event listener pattern
      const pattern = this.analyzeEventListenerPattern(addEventListenerNode);
      if (!pattern) {
        return {
          success: false,
          error: 'Could not analyze event listener pattern',
        };
      }

      // Generate appropriate cleanup based on context
      const context = this.analyzeContext(addEventListenerNode);
      const cleanupStrategy = this.determineCleanupStrategy(pattern, context);

      const transformation = this.generateCleanupTransformation(
        addEventListenerNode,
        pattern,
        cleanupStrategy
      );

      const fixedCode = this.applyTransformation(transformation);

      return {
        success: true,
        fix: {
          id: `event-listener-cleanup-${Date.now()}`,
          type: 'uncleaned-event-listener',
          file: this.fileName,
          originalCode: this.getNodeText(addEventListenerNode),
          fixedCode: fixedCode,
          description: this.generateFixDescription(pattern, cleanupStrategy),
          confidence: this.calculateConfidence(pattern, cleanupStrategy),
          requiresManualReview: cleanupStrategy.requiresManualReview,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Error generating event listener fix: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private analyzeEventListenerPattern(
    node: ts.CallExpression
  ): EventListenerPattern | null {
    if (node.arguments.length < 2) return null;

    // Extract target (element)
    let target = 'element';
    let isWindowEvent = false;
    let isDocumentEvent = false;
    let isMediaQuery = false;

    if (ts.isPropertyAccessExpression(node.expression)) {
      const targetNode = node.expression.expression;
      target = this.getNodeText(targetNode);

      if (ts.isIdentifier(targetNode)) {
        isWindowEvent = targetNode.text === 'window';
        isDocumentEvent = targetNode.text === 'document';
      }
    }

    // Extract event name
    const eventArg = node.arguments[0];
    let event = '';
    if (ts.isStringLiteral(eventArg)) {
      event = eventArg.text;
    } else {
      event = this.getNodeText(eventArg);
    }

    // Check for media query events
    isMediaQuery = event === 'change' && target.includes('matchMedia');

    // Extract handler
    const handlerArg = node.arguments[1];
    const handler = this.getNodeText(handlerArg);

    // Determine handler type
    let handlerType: 'inline' | 'reference' | 'arrow' = 'reference';
    if (ts.isArrowFunction(handlerArg) || ts.isFunctionExpression(handlerArg)) {
      handlerType = 'inline';
    }

    // Extract options if present
    const options = node.arguments[2]
      ? this.getNodeText(node.arguments[2])
      : undefined;

    return {
      target,
      event,
      handler,
      options,
      handlerType,
      isMediaQuery,
      isWindowEvent,
      isDocumentEvent,
    };
  }

  private analyzeContext(node: ts.Node): EventListenerContext {
    const containingFunction = this.findContainingFunction(node);
    const isInUseEffect = this.isInUseEffect(containingFunction);
    const isInComponent = this.isInReactComponent(containingFunction);
    const hasExistingCleanup = this.hasExistingCleanup(containingFunction);

    return {
      containingFunction,
      isInUseEffect,
      isInComponent,
      hasExistingCleanup,
      needsUseEffectWrapper: !isInUseEffect && isInComponent,
    };
  }

  private determineCleanupStrategy(
    pattern: EventListenerPattern,
    context: EventListenerContext
  ): CleanupStrategy {
    let strategy: CleanupStrategy = {
      type: 'add-to-existing-cleanup',
      requiresManualReview: false,
      needsVariableExtraction: false,
      needsUseEffectWrapper: false,
    };

    // Handle inline handlers - need to extract to variable
    if (pattern.handlerType === 'inline') {
      strategy.needsVariableExtraction = true;
      strategy.requiresManualReview = true; // Inline handlers are complex
    }

    // Handle media query listeners - special cleanup pattern
    if (pattern.isMediaQuery) {
      strategy.type = 'media-query-cleanup';
      strategy.requiresManualReview = false;
    }

    // Handle window/document events - global cleanup
    if (pattern.isWindowEvent || pattern.isDocumentEvent) {
      strategy.type = 'global-event-cleanup';
      strategy.requiresManualReview = false;
    }

    // Determine if we need useEffect wrapper
    if (context.needsUseEffectWrapper) {
      strategy.needsUseEffectWrapper = true;
    }

    // If no existing cleanup, create new cleanup function
    if (!context.hasExistingCleanup && context.isInUseEffect) {
      strategy.type = 'create-cleanup-function';
    }

    return strategy;
  }

  private generateCleanupTransformation(
    node: ts.CallExpression,
    pattern: EventListenerPattern,
    strategy: CleanupStrategy
  ): CodeTransformation {
    switch (strategy.type) {
      case 'add-to-existing-cleanup':
        return this.addToExistingCleanup(node, pattern, strategy);

      case 'create-cleanup-function':
        return this.createCleanupFunction(node, pattern, strategy);

      case 'media-query-cleanup':
        return this.createMediaQueryCleanup(node, pattern, strategy);

      case 'global-event-cleanup':
        return this.createGlobalEventCleanup(node, pattern, strategy);

      default:
        return this.addToExistingCleanup(node, pattern, strategy);
    }
  }

  private addToExistingCleanup(
    node: ts.CallExpression,
    pattern: EventListenerPattern,
    strategy: CleanupStrategy
  ): CodeTransformation {
    const containingFunction = this.findContainingFunction(node);
    if (!containingFunction) {
      throw new Error('No containing function found');
    }

    // Generate cleanup code
    const cleanupCode = this.generateRemoveEventListenerCode(pattern);

    if (strategy.needsUseEffectWrapper) {
      return this.wrapInUseEffectWithCleanup(node, cleanupCode);
    }

    // Find existing return statement in useEffect
    const returnStatement = this.findReturnStatement(containingFunction);
    if (returnStatement?.expression) {
      return this.addToExistingReturnFunction(returnStatement, cleanupCode);
    }

    // Add new return statement
    return this.addNewReturnStatement(containingFunction, cleanupCode);
  }

  private createCleanupFunction(
    node: ts.CallExpression,
    pattern: EventListenerPattern,
    strategy: CleanupStrategy
  ): CodeTransformation {
    const cleanupCode = this.generateRemoveEventListenerCode(pattern);
    const containingFunction = this.findContainingFunction(node);

    if (!containingFunction) {
      throw new Error('No containing function found');
    }

    const returnCode = `
    return () => {
      ${cleanupCode}
    };`;

    // Insert before the closing brace of the function
    const insertPosition = containingFunction.getEnd() - 1;
    return {
      start: insertPosition,
      end: insertPosition,
      replacement: returnCode,
    };
  }

  private createMediaQueryCleanup(
    node: ts.CallExpression,
    pattern: EventListenerPattern,
    strategy: CleanupStrategy
  ): CodeTransformation {
    // Media queries need special handling
    const mediaQueryVar = this.extractMediaQueryVariable(node);
    const cleanupCode = mediaQueryVar
      ? `${mediaQueryVar}.removeEventListener('${pattern.event}', ${pattern.handler});`
      : this.generateRemoveEventListenerCode(pattern);

    if (strategy.needsUseEffectWrapper) {
      return this.wrapInUseEffectWithCleanup(node, cleanupCode);
    }

    return this.addToExistingCleanup(node, pattern, strategy);
  }

  private createGlobalEventCleanup(
    node: ts.CallExpression,
    pattern: EventListenerPattern,
    strategy: CleanupStrategy
  ): CodeTransformation {
    // Window and document events
    const cleanupCode = this.generateRemoveEventListenerCode(pattern);

    if (strategy.needsUseEffectWrapper) {
      return this.wrapInUseEffectWithCleanup(node, cleanupCode);
    }

    return this.addToExistingCleanup(node, pattern, strategy);
  }

  private generateRemoveEventListenerCode(
    pattern: EventListenerPattern
  ): string {
    const optionsStr = pattern.options ? `, ${pattern.options}` : '';

    // Handle different handler types
    let handlerRef = pattern.handler;
    if (pattern.handlerType === 'inline') {
      // For inline handlers, we need to use the same function reference
      // This requires variable extraction which should be handled separately
      handlerRef = 'handlerRef'; // Placeholder - should be extracted variable name
    }

    return `${pattern.target}.removeEventListener('${pattern.event}', ${handlerRef}${optionsStr});`;
  }

  private wrapInUseEffectWithCleanup(
    node: ts.Node,
    cleanupCode: string
  ): CodeTransformation {
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
      replacement: wrappedCode,
    };
  }

  private addToExistingReturnFunction(
    returnStatement: ts.ReturnStatement,
    cleanupCode: string
  ): CodeTransformation {
    if (!returnStatement.expression) {
      throw new Error('Return statement has no expression');
    }

    if (
      ts.isArrowFunction(returnStatement.expression) ||
      ts.isFunctionExpression(returnStatement.expression)
    ) {
      const cleanupFunction = returnStatement.expression;
      if (cleanupFunction.body && ts.isBlock(cleanupFunction.body)) {
        const insertPosition = cleanupFunction.body.getEnd() - 1;
        return {
          start: insertPosition,
          end: insertPosition,
          replacement: `\n      ${cleanupCode}`,
        };
      }
    }

    throw new Error('Cannot add to existing return function');
  }

  private addNewReturnStatement(
    containingFunction: ts.Node,
    cleanupCode: string
  ): CodeTransformation {
    const insertPosition = containingFunction.getEnd() - 1;
    const returnCode = `
    return () => {
      ${cleanupCode}
    };`;

    return {
      start: insertPosition,
      end: insertPosition,
      replacement: returnCode,
    };
  }

  private extractMediaQueryVariable(node: ts.Node): string | null {
    // Look for matchMedia calls in the same scope
    let current = node.parent;
    while (current) {
      if (ts.isVariableDeclaration(current)) {
        const initializer = current.initializer;
        if (
          initializer &&
          ts.isCallExpression(initializer) &&
          ts.isPropertyAccessExpression(initializer.expression) &&
          this.getNodeText(initializer.expression).includes('matchMedia')
        ) {
          return ts.isIdentifier(current.name) ? current.name.text : null;
        }
      }
      current = current.parent;
    }
    return null;
  }

  private generateFixDescription(
    pattern: EventListenerPattern,
    strategy: CleanupStrategy
  ): string {
    let description = `Added removeEventListener cleanup for ${pattern.event} event`;

    if (pattern.isMediaQuery) {
      description += ' (media query listener)';
    } else if (pattern.isWindowEvent) {
      description += ' (window event)';
    } else if (pattern.isDocumentEvent) {
      description += ' (document event)';
    }

    if (strategy.needsVariableExtraction) {
      description += ' with handler extraction';
    }

    return description;
  }

  private calculateConfidence(
    pattern: EventListenerPattern,
    strategy: CleanupStrategy
  ): number {
    let confidence = 0.9;

    // Reduce confidence for complex patterns
    if (pattern.handlerType === 'inline') {
      confidence -= 0.2;
    }

    if (strategy.needsVariableExtraction) {
      confidence -= 0.1;
    }

    if (pattern.isMediaQuery) {
      confidence -= 0.05; // Media queries are slightly more complex
    }

    return Math.max(0.5, confidence);
  }

  // Helper methods
  private findNodeAtPosition(line: number, column: number): ts.Node | null {
    const position = this.sourceFile.getPositionOfLineAndCharacter(
      line - 1,
      column - 1
    );

    function findNode(node: ts.Node): ts.Node | null {
      if (node.getStart() <= position && position < node.getEnd()) {
        return ts.forEachChild(node, findNode) || node;
      }
      return null;
    }

    return findNode(this.sourceFile);
  }

  private findContainingFunction(node: ts.Node): ts.Node | null {
    let current = node.parent;
    while (current) {
      if (
        ts.isFunctionDeclaration(current) ||
        ts.isArrowFunction(current) ||
        ts.isFunctionExpression(current) ||
        ts.isMethodDeclaration(current)
      ) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  private isInUseEffect(container: ts.Node | null): boolean {
    if (!container) return false;

    let current = container.parent;
    while (current) {
      if (
        ts.isCallExpression(current) &&
        ts.isIdentifier(current.expression) &&
        current.expression.text === 'useEffect'
      ) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  private isInReactComponent(container: ts.Node | null): boolean {
    if (!container) return false;

    // Look for React component patterns
    let current = container;
    while (current) {
      if (ts.isFunctionDeclaration(current) || ts.isArrowFunction(current)) {
        // Check if function name starts with uppercase (React component convention)
        if (
          ts.isFunctionDeclaration(current) &&
          current.name &&
          ts.isIdentifier(current.name)
        ) {
          const name = current.name.text;
          if (name[0] === name[0].toUpperCase()) {
            return true;
          }
        }

        // Check for JSX return
        const hasJSXReturn = this.hasJSXReturn(current);
        if (hasJSXReturn) {
          return true;
        }
      }
      current = current.parent;
    }
    return false;
  }

  private hasJSXReturn(functionNode: ts.Node): boolean {
    let hasJSX = false;

    const visit = (node: ts.Node) => {
      if (ts.isReturnStatement(node) && node.expression) {
        if (
          ts.isJsxElement(node.expression) ||
          ts.isJsxFragment(node.expression) ||
          ts.isJsxSelfClosingElement(node.expression)
        ) {
          hasJSX = true;
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(functionNode);
    return hasJSX;
  }

  private hasExistingCleanup(container: ts.Node | null): boolean {
    if (!container) return false;

    let hasCleanup = false;

    const visit = (node: ts.Node) => {
      if (ts.isReturnStatement(node) && node.expression) {
        if (
          ts.isArrowFunction(node.expression) ||
          ts.isFunctionExpression(node.expression)
        ) {
          hasCleanup = true;
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(container);
    return hasCleanup;
  }

  private findReturnStatement(container: ts.Node): ts.ReturnStatement | null {
    let returnStatement: ts.ReturnStatement | null = null;

    const visit = (node: ts.Node) => {
      if (ts.isReturnStatement(node)) {
        returnStatement = node;
        return;
      }
      ts.forEachChild(node, visit);
    };

    visit(container);
    return returnStatement;
  }

  private applyTransformation(transformation: CodeTransformation): string {
    const before = this.sourceCode.substring(0, transformation.start);
    const after = this.sourceCode.substring(transformation.end);
    return before + transformation.replacement + after;
  }

  private getNodeText(node: ts.Node): string {
    return this.sourceCode.substring(node.getFullStart(), node.getEnd()).trim();
  }
}

// Supporting interfaces
interface EventListenerContext {
  containingFunction: ts.Node | null;
  isInUseEffect: boolean;
  isInComponent: boolean;
  hasExistingCleanup: boolean;
  needsUseEffectWrapper: boolean;
}

interface CleanupStrategy {
  type:
    | 'add-to-existing-cleanup'
    | 'create-cleanup-function'
    | 'media-query-cleanup'
    | 'global-event-cleanup';
  requiresManualReview: boolean;
  needsVariableExtraction: boolean;
  needsUseEffectWrapper: boolean;
}

// Factory function
export function createEventListenerFixGenerator(
  sourceCode: string,
  fileName: string
): EventListenerFixGenerator {
  return new EventListenerFixGenerator(sourceCode, fileName);
}
