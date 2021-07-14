import { TextRange, Token } from "./tokenizer";
import { Parser } from "./parser";
import { SplashType, TypeToken } from "./oop";
import { Processor } from "./processor";
import { Generated, GeneratedBlock, GeneratedStatement, SplashScript } from "./generator";


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
        
    }
    process(proc: Processor): void {
        proc.addVariable(this.name, this.init ? this.init.getResultType() : ()=>SplashType.object)
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
    abstract getResultType(proc: Processor): ()=>SplashType
}

export class BinaryExpression extends Expression {
    constructor(public left: Expression, public op: Token, public right: Expression) {
        super("binary_expression")
    }
}

export class UnaryExpression extends Expression {
    constructor(public op: Token, public expr: Expression) {
        super("unary_expression")
    }
}

export class LiteralExpression extends Expression {
    constructor(public token: Token) {
        super('literal_expression')
    }
}

export class InvalidExpression extends Expression {
    constructor() {
        super('invalid_expression')
    }
}

export class ArrayExpression extends Expression {
    constructor(public values: Expression[]) {
        super('array_expression')
    }
}

export class Assignment extends Statement {
    constructor(public variable: AssignableExpression, public op: Token, public expression: Expression) {
        super("assignment",op.range)
    }
}

export class AssignableExpression extends Expression {
    
}

export class FieldAccess extends AssignableExpression {
    constructor(public field: Token, public parent: Expression) {
        super("field_access")
    }
}

export class VariableAccess extends AssignableExpression {
    constructor(public name: Token) {
        super("variable_access")
    }
}

export class CallAccess extends Expression {
    constructor(public params: Expression[], public parent: Expression) {
        super("call_access")
    }
}

export class CallStatement extends Statement {
    constructor(public call: CallAccess, range: TextRange) {
        super("call",range)
    }
}

export class ModifierList extends ASTNode {

    modifiers: Token[] = []

    constructor() {
        super('modifiers')
    }

    has(mod: string) {
        for (let t of this.modifiers) {
            if (t.value == mod) return true
        }
        return false
    }

    add(parser: Parser, mod: Token) {
        if (this.has(mod.value)) {
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
    
    assertHasOnly(parser: Parser, ...mods: string[]) {
        for (let m of this.modifiers) {
            if (!mods.includes(m.value)) {
                parser.error(m, "This modifier is invalid here")
            }
        }
    }
}

export class Parameter extends ASTNode {

    constructor(public name: Token, public type: TypeToken, public defValue?: Expression, public vararg?: boolean) {
        super('parameter')
    }

}

export class SimpleFunction extends Statement {

    constructor(public label: TextRange, public modifiers: ModifierList, public name: Token, public params: Parameter[], public code?: CodeBlock) {
        super('function',label)
    }

    process(proc: Processor) {
        proc.functions.push(this)
    }

}

export class ReturnStatement extends Statement {
    constructor(label: TextRange, public expr: Expression | undefined) {
        super('return',label)
    }
}