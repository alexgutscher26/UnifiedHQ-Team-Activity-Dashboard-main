import * as ts from 'typescript';
import {
  Fix,
  FixGenerationResult,
  CodeTransformation,
} from './memory-leak-fix-generator';
import { LeakDetectionResult } from './memory-leak-detection-patterns';

export interface TimerPattern {
  timerFunction: 'setInterval' | 'setTimeout';
  clearFunction: 'clearInterval' | 'clearTimeout';
  callback: string;
  delay: string;
  variableName?: string;
  isAssigned: boolean;
  isInUseEffect: boolean;
  isInComponent: boolean;
  hasExistingCleanup: boolean;
}

export class TimerCleanupFixGenerator {
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

  generateTimerCleanupFix(leak: LeakDetectionResult): FixGenerationResult {
    try {
      const timerNode = this.findNodeAtPosition(leak.line, leak.column);
      if (!timerNode || !ts.isCallExpression(timerNode)) {
        return { success: false, error: 'Could not find timer call' };
      }

      // Analyze the timer pattern
      const pattern = this.analyzeTimerPattern(timerNode);
      if (!pattern) {
        return { success: false, error: 'Could not analyze timer pattern' };
      }

      // Generate appropriate cleanup transformation
      const transformation = this.generateTimerCleanupTransformation(
        timerNode,
        pattern
      );
      const fixedCode = this.applyTransformation(transformation);

      return {
        success: true,
        fix: {
          id: `timer-cleanup-${Date.now()}`,
          type: leak.type,
          file: this.fileName,
          originalCode: this.getNodeText(timerNode),
          fixedCode: fixedCode,
          description: this.generateFixDescription(pattern),
          confidence: this.calculateConfidence(pattern),
          requiresManualReview: this.requiresManualReview(pattern),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Error generating timer cleanup fix: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private analyzeTimerPattern(node: ts.CallExpression): TimerPattern | null {
    if (!ts.isIdentifier(node.expression)) return null;

    const timerFunction = node.expression.text as 'setInterval' | 'setTimeout';
    if (timerFunction !== 'setInterval' && timerFunction !== 'setTimeout') {
      return null;
    }

    const clearFunction =
      timerFunction === 'setInterval' ? 'clearInterval' : 'clearTimeout';

    // Extract callback and delay
    const callback = node.arguments[0]
      ? this.getNodeText(node.arguments[0])
      : '';
    const delay = node.arguments[1] ? this.getNodeText(node.arguments[1]) : '0';

    // Check if timer is assigned to a variable
    const variableName = this.extractVariableName(node);
    const isAssigned = !!variableName;

    // Analyze context
    const containingFunction = this.findContainingFunction(node);
    const isInUseEffect = this.isInUseEffect(containingFunction);
    const isInComponent = this.isInReactComponent(containingFunction);
    const hasExistingCleanup = this.hasExistingCleanup(containingFunction);

    return {
      timerFunction,
      clearFunction,
      callback,
      delay,
      variableName,
      isAssigned,
      isInUseEffect,
      isInComponent,
      hasExistingCleanup,
    };
  }

  private generateTimerCleanupTransformation(
    node: ts.CallExpression,
    pattern: TimerPattern
  ): CodeTransformation {
    if (!pattern.isAssigned) {
      // Need to assign timer to variable first, then add cleanup
      return this.createTimerWithVariableAndCleanup(node, pattern);
    }

    if (pattern.isInUseEffect) {
      if (pattern.hasExistingCleanup) {
        return this.addToExistingUseEffectCleanup(node, pattern);
      } else {
        return this.createUseEffectCleanup(node, pattern);
      }
    }

    if (pattern.isInComponent) {
      return this.wrapInUseEffectWithCleanup(node, pattern);
    }

    // Default: add cleanup to current scope
    return this.addCleanupToCurrentScope(node, pattern);
  }

  private createTimerWithVariableAndCleanup(
    node: ts.CallExpression,
    pattern: TimerPattern
  ): CodeTransformation {
    const timerVar = this.generateTimerVariableName(pattern);
    const timerCall = this.getNodeText(node);

    let replacement: string;

    if (pattern.isInUseEffect) {
      // In useEffect - create variable and add cleanup
      replacement = `const ${timerVar} = ${timerCall};
    
    return () => {
      ${pattern.clearFunction}(${timerVar});
    };`;
    } else if (pattern.isInComponent) {
      // In component - wrap in useEffect
      replacement = `useEffect(() => {
    const ${timerVar} = ${timerCall};
    
    return () => {
      ${pattern.clearFunction}(${timerVar});
    };
  }, []);`;
    } else {
      // In regular function - just create variable (cleanup responsibility to caller)
      replacement = `const ${timerVar} = ${timerCall};
  // TODO: Call ${pattern.clearFunction}(${timerVar}) when cleanup is needed`;
    }

    return {
      start: node.getFullStart(),
      end: node.getEnd(),
      replacement: replacement,
    };
  }

  /**
   * Adds a cleanup function to an existing useEffect cleanup function.
   *
   * This method locates the containing function of the provided node and constructs a cleanup code string
   * using the clear function and variable name from the TimerPattern. It then searches for an existing return
   * statement within the containing function. If found, it adds the cleanup code to the existing cleanup function;
   * otherwise, it throws an error indicating that no cleanup function exists.
   *
   * @param node - The CallExpression node for which the cleanup is being added.
   * @param pattern - The TimerPattern containing the clear function and variable name.
   */
  private addToExistingUseEffectCleanup(
    node: ts.CallExpression,
    pattern: TimerPattern
  ): CodeTransformation {
    const containingFunction = this.findContainingFunction(node);
    if (!containingFunction) {
      throw new Error('No containing function found');
    }

    const cleanupCode = `${pattern.clearFunction}(${pattern.variableName});`;

    // Find existing return statement
    const returnStatement = this.findReturnStatement(containingFunction);
    if (returnStatement?.expression) {
      return this.addToExistingCleanupFunction(returnStatement, cleanupCode);
    }

    throw new Error('No existing cleanup function found');
  }

  private createUseEffectCleanup(
    node: ts.CallExpression,
    pattern: TimerPattern
  ): CodeTransformation {
    const containingFunction = this.findContainingFunction(node);
    if (!containingFunction) {
      throw new Error('No containing function found');
    }

    const cleanupCode = `${pattern.clearFunction}(${pattern.variableName});`;
    const returnCode = `
    return () => {
      ${cleanupCode}
    };`;

    // Insert before the closing brace of the useEffect
    const insertPosition = containingFunction.getEnd() - 1;
    return {
      start: insertPosition,
      end: insertPosition,
      replacement: returnCode,
    };
  }

  private wrapInUseEffectWithCleanup(
    node: ts.CallExpression,
    pattern: TimerPattern
  ): CodeTransformation {
    const timerCall = this.getNodeText(node);
    const timerVar =
      pattern.variableName || this.generateTimerVariableName(pattern);

    const wrappedCode = `useEffect(() => {
    const ${timerVar} = ${timerCall};
    
    return () => {
      ${pattern.clearFunction}(${timerVar});
    };
  }, []);`;

    return {
      start: node.getFullStart(),
      end: node.getEnd(),
      replacement: wrappedCode,
    };
  }

  private addCleanupToCurrentScope(
    node: ts.CallExpression,
    pattern: TimerPattern
  ): CodeTransformation {
    // For non-React contexts, just add a comment about cleanup
    const timerCall = this.getNodeText(node);
    const cleanupComment = `// Remember to call ${pattern.clearFunction}(${pattern.variableName}) when cleanup is needed`;

    return {
      start: node.getFullStart(),
      end: node.getEnd(),
      replacement: `${timerCall}; ${cleanupComment}`,
    };
  }

  private addToExistingCleanupFunction(
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
      } else if (cleanupFunction.body) {
        // Expression body - convert to block
        const existingBody = this.getNodeText(cleanupFunction.body);
        const newBody = `{
      ${existingBody};
      ${cleanupCode}
    }`;

        return {
          start: cleanupFunction.body.getFullStart(),
          end: cleanupFunction.body.getEnd(),
          replacement: newBody,
        };
      }
    }

    throw new Error('Cannot add to existing cleanup function');
  }

  private generateTimerVariableName(pattern: TimerPattern): string {
    const base =
      pattern.timerFunction === 'setInterval' ? 'interval' : 'timeout';
    return `${base}Id`;
  }

  private generateFixDescription(pattern: TimerPattern): string {
    let description = `Added ${pattern.clearFunction} cleanup for ${pattern.timerFunction}`;

    if (!pattern.isAssigned) {
      description += ' with variable assignment';
    }

    if (!pattern.isInUseEffect && pattern.isInComponent) {
      description += ' wrapped in useEffect';
    }

    return description;
  }

  private calculateConfidence(pattern: TimerPattern): number {
    let confidence = 0.95;

    // Reduce confidence if not assigned to variable
    if (!pattern.isAssigned) {
      confidence -= 0.1;
    }

    // Reduce confidence if not in proper React context
    if (!pattern.isInUseEffect && !pattern.isInComponent) {
      confidence -= 0.2;
    }

    return Math.max(0.6, confidence);
  }

  private requiresManualReview(pattern: TimerPattern): boolean {
    // Requires manual review if:
    // 1. Not assigned to variable (we're creating one)
    // 2. Not in React context (unclear cleanup responsibility)
    // 3. Complex callback function
    return (
      !pattern.isAssigned ||
      (!pattern.isInUseEffect && !pattern.isInComponent) ||
      this.isComplexCallback(pattern.callback)
    );
  }

  private isComplexCallback(callback: string): boolean {
    // Simple heuristic - if callback is more than a simple function reference
    return (
      callback.includes('{') || callback.includes('=>') || callback.length > 50
    );
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

  private extractVariableName(node: ts.Node): string | null {
    let current = node.parent;

    while (current) {
      if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
        return current.name.text;
      }
      if (
        ts.isBinaryExpression(current) &&
        current.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        if (ts.isIdentifier(current.left)) {
          return current.left.text;
        }
      }
      current = current.parent;
    }

    return null;
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

// Factory function
export function createTimerCleanupFixGenerator(
  sourceCode: string,
  fileName: string
): TimerCleanupFixGenerator {
  return new TimerCleanupFixGenerator(sourceCode, fileName);
}
