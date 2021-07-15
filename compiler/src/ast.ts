import { TextRange, Token } from "./tokenizer";
import { Parser } from "./parser";
import { SplashType, TypeToken } from "./oop";
import { Processor } from "./processor";
import { GenCall, Generated, GeneratedBlock, GeneratedExpression, GeneratedStatement, GenVarDeclaration, SplashScript } from "./generator";
import { BinaryOperator, UnaryOperator } from "./operators";


export abstract class ASTNode {
    constructor(public id: string) {

    }
}

export class RootNode extends ASTNode {

    statements: Statement[] = []

    constructor() {
        super("root")
    }
    
    index(proc: Processor) {
        for (let s of this.statements) {
            s.index(proc)
        }
    }

    process(proc: Processor) {
        for (let s of this.statements) {
            s.process(proc)
        }
    }

    generate(proc: Processor): Generated {
        return new SplashScript(this.statements.map(s=>s.generate(proc)))
    }
}

export abstract class Statement extends ASTNode {
    constructor(id: string, public label: TextRange) {
        super(id)
    }

    index(proc: Processor) {

    }

    abstract process(proc: Processor): void

    abstract generate(proc: Processor): GeneratedStatement
}

export class CodeBlock extends Statement {
    statements: Statement[] = []

    process(proc: Processor) {
        proc.push()
        for (let s of this.statements) {
            s.process(proc)
        }
        proc.pop()
    }

    generate(proc: Processor) {
        return new GeneratedBlock(this.statements.map(s=>s.generate(proc)))
    }
}

export class MainBlock extends CodeBlock {
    constructor(label: TextRange, statements: Statement[]) {
        super("main",label)
        this.statements = statements
    }
}

export class VarDeclaration extends Statement {
    
    constructor(label: TextRange, public name: Token, public init?: Expression) {
        super("var_declaration",label)
    }

    generate(proc: Processor): GeneratedStatement {
        return new GenVarDeclaration(this.name.value,this.init?.generate())
    }
    process(proc: Processor): void {
        proc.addVariable(this.name, this.init ? this.init.getResultType(proc) : SplashType.object)
    }

    
}

export class IfStatement extends Statement {
    
    constructor(label: TextRange, public expr: Expression, public then: Statement, public orElse?: ElseStatement) {
        super("if",label)
    }

    process(proc: Processor): void {
        
    }
    generate(proc: Processor): GeneratedStatement {
        throw new Error("Method not implemented.");
    }
}

export class ElseStatement extends Statement {
    
    constructor(label: TextRange, public code: Statement) {
        super("else",label)
    }

    process(proc: Processor): void {
        proc.push()
        this.code.process(proc)
        proc.pop()
    }
    generate(proc: Processor): GeneratedStatement {
        return this.code.generate(proc)
    }
}

export abstract class Expression extends ASTNode {

    constructor(id: string, public range: TextRange) {
        super(id)
    }

    abstract getResultType(proc: Processor): SplashType

    abstract generate(proc: Processor): GeneratedExpression
}

export class ExpressionList {

    constructor(public values: Expression[], public range: TextRange) {

    }

    canApplyTo(parameters: Parameter[]) {

    }

}

export class BinaryExpression extends Expression {
    
    constructor(public left: Expression, public op: Token, public right: Expression) {
        super("binary_expression",TextRange.between(left.range, right.range))
    }

    getResultType(proc: Processor): SplashType {
        let leftType = this.left.getResultType(proc)
        let rightType = this.right.getResultType(proc)
        let binop = leftType.getBinaryOperation(this.op.value as BinaryOperator, rightType)
        if (binop) {
            return proc.resolveType(binop.retType)
        }
        proc.error(this.op.range, "Operator " + this.op.value + " cannot be applied to " + leftType.name)
        return SplashType.object
    }

    generate(proc: Processor): GeneratedExpression {
        
    }
}

export class UnaryExpression extends Expression {
    constructor(public op: Token, public expr: Expression) {
        super("unary_expression", TextRange.between(op.range, expr.range))
    }

    getResultType(proc: Processor) {
        let type = this.expr.getResultType(proc)
        let uop = type.getUnaryOperation(this.op.value as UnaryOperator)
        if (uop) {
            return uop
        }
    }
}

export class LiteralExpression extends Expression {
    constructor(public token: Token) {
        super('literal_expression', token.range)
    }
}

export class InvalidExpression extends Expression {
    constructor() {
        super('invalid_expression', TextRange.end)
    }
}

export class ArrayExpression extends Expression {
    constructor(public values: ExpressionList) {
        super('array_expression', values.range)
    }
}

export class Assignment extends Statement {
    constructor(public variable: AssignableExpression, public op: Token, public expression: Expression) {
        super("assignment",op.range)
    }
}

export abstract class AssignableExpression extends Expression {
    
}

export class FieldAccess extends AssignableExpression {
    constructor(public field: Token, public parent: Expression) {
        super("field_access",TextRange.between(parent.range, field.range))
    }
}

export class VariableAccess extends AssignableExpression {
    constructor(public name: Token) {
        super("variable_access", name.range)
    }
}

export class CallAccess extends Expression {
    
    constructor(public params: ExpressionList, public parent: Expression) {
        super("call_access", params.range)
    }

    getResultType(proc: Processor): SplashType {
        let res = this.parent.getResultType(proc)
        let invoker = res.getInvoker(this.params);
        if (invoker) {
            return proc.resolveType(invoker.retType)
        }
        return SplashType.object
    }
    generate(proc: Processor): GeneratedExpression {
        
    }
}

export class CallStatement extends Statement {
    
    constructor(public call: CallAccess, range: TextRange) {
        super("call",range)
    }

    process(proc: Processor): void {
        this.call.getResultType(proc)
    }

    generate(proc: Processor): GeneratedStatement {
        return new GenCall(this.call.generate(proc))
    }
}

export type Modifier = 'private'|'protected'|'abstract'|'native'|'final'|'static'|'readonly'|'operator'|'iterator'|'get'|'set'|'indexer'|'accessor'|'invoker'

export class ModifierList extends ASTNode {

    modifiers: Token[] = []

    constructor() {
        super('modifiers')
    }

    has(mod: Modifier) {
        for (let t of this.modifiers) {
            if (t.value == mod) return true
        }
        return false
    }

    add(parser: Parser, mod: Token) {
        if (this.has(mod.value as Modifier)) {
            parser.error(mod, "Duplicate modifier '" + mod.value + "'")
        } else {
            this.modifiers.push(mod)
        }
    }

    assertEmpty(parser: Parser) {
        if (this.modifiers.length > 0) {
            parser.errorRange(TextRange.between(this.modifiers[0].range,this.modifiers[this.modifiers.length - 1].range),"Unexpected modifiers")
        }
    }
    
    assertHasOnly(parser: Parser, ...mods: Modifier[]) {
        for (let m of this.modifiers) {
            if (!mods.includes(m.value as Modifier)) {
                parser.error(m, "This modifier is invalid here")
            }
        }
    }
}

export class Parameter extends ASTNode {

    constructor(public name: Token, public type: TypeToken, public defValue?: Expression, public vararg?: boolean) {
        super('parameter')
    }

    process(proc: Processor) {
        this.type.validate(proc)
        if (this.vararg && this.defValue) {
            proc.error(this.name.range, "A parameter cannot be both vararg and have a default value")
        }
        if (this.defValue) {
            if (!this.type.canAccept(this.defValue.getResultType(proc))) {
                proc.error(this.defValue.range, "This expression cannot be assigned to this parameter's type")
            }
        }
    }

}

export class SimpleFunction extends Statement {
    
    constructor(public label: TextRange, public modifiers: ModifierList, public name: Token, public params: Parameter[], public code?: CodeBlock) {
        super('function',label)
    }

    index(proc: Processor) {
        proc.functions.push(this)
    }

    process(proc: Processor) {
        if (this.modifiers.has('native')) {
            if (this.code) {
                proc.error(this.code.label, "Native functions may not have a body")
            }
        } else if (!this.code) {
            proc.error(this.label, "Missing function body")
        }
        let uniqueNames: string[] = []
        let hasVararg = false
        proc.push()
        for (let p of this.params) {
            p.process(proc)
            if (uniqueNames.includes(p.name.value)) {
                proc.error(p.name.range, "Duplicate parameter '" + p.name.value + "'")
            } else {
                uniqueNames.push(p.name.value)
                proc.addVariable(p.name, proc.resolveType(p.type))
            }
            if (hasVararg) {
                proc.error(p.name.range, "Vararg parameter must be the last parameter")
            }
            
        }

        if (this.code) {
            this.code.process(proc)
        }

        proc.pop()
        
    }

    generate(proc: Processor): GeneratedStatement {
        
    }

}

export class ReturnStatement extends Statement {
    constructor(label: TextRange, public expr: Expression | undefined) {
        super('return',label)
    }
}