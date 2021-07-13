import { TextRange, Token } from "./tokenizer";
import { BinaryOperator, UnaryOperator, AssignmentOperator } from "./operators";


export abstract class ASTNode {
    constructor(public id: string) {

    }
}

export class RootNode extends ASTNode {

    statements: Statement[] = []

    constructor() {
        super("root")
    }
}

export abstract class Statement extends ASTNode {
    constructor(id: string, public label: TextRange) {
        super(id)
    }
}

export class CodeBlock extends Statement {

}

export class MainBlock extends CodeBlock {
    constructor(label: TextRange) {
        super("main",label)
    }
}

export class VarDeclaration extends Statement {
    constructor(label: TextRange, public name: Token, public init?: Expression) {
        super("var_declaration",label)
    }
}

export class IfStatement extends Statement {
    constructor(label: TextRange, public expr: Expression, public then: Statement, public orElse?: ElseStatement) {
        super("if",label)
    }
}

export class ElseStatement extends Statement {
    constructor(label: TextRange, public code: Statement) {
        super("else",label)
    }
}

export abstract class Expression extends ASTNode {
    
}

export class BinaryExpression extends Expression {
    constructor(public left: Expression, public op: BinaryOperator, public right: Expression) {
        super("binary_expression")
    }
}

export class UnaryExpression extends Expression {
    constructor(public op: UnaryOperator, public expr: Expression) {
        super("unary_expression")
    }
}

export class Assignment extends Statement {
    constructor(public variable: AssignableExpression, opRange: TextRange, public op: AssignmentOperator, public expression: Expression) {
        super("assignment",opRange)
    }
}

export class AssignableExpression extends ASTNode {
    constructor(public assignable: AssignableAccessNode, public chain?: AccessNode) {
        super("assignable_expression")
    }
}

export abstract class AccessNode extends ASTNode {
    constructor(name: string, public parent?: AccessNode) {
        super(name)
    }
}

export class AssignableAccessNode extends AccessNode {
    
}

export class FieldAccess extends AssignableAccessNode {
    constructor(public field: Token, parent: AccessNode) {
        super("field_access",parent)
    }
}

export class VariableRootAccess extends AssignableAccessNode {
    constructor(public name: Token) {
        super("variable_access")
    }
}

export class CallAccess extends AccessNode {
    constructor(public params: Expression[], parent?: AccessNode) {
        super("call_access",parent)
    }
}