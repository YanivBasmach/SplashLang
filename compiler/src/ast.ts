import { TextRange, Token, TokenType } from "./tokenizer";
import { Parser } from "./parser";
import { DummySplashType, Parameter, SplashClass, SplashComboType, SplashType, TypeToken } from "./oop";
import { Processor } from "./processor";
import { GenArrayCreation, GenAssignableExpression, GenAssignment, GenCall, GenCallAccess, GenClassDecl, Generated, GeneratedBinary, GeneratedBlock, GeneratedExpression, GeneratedLiteral, GeneratedReturn, GeneratedStatement, GeneratedUnary, GenFieldAccess, GenFunction, GenVarAccess, GenVarDeclaration, SplashScript } from "./generator";
import { AssignmentOperator, BinaryOperator, UnaryOperator } from "./operators";
import { SplashArray, SplashFunctionType, SplashInt, SplashString } from "./primitives";


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
        let script = new SplashScript()
        for (let s of this.statements) {
            if (s instanceof VarDeclaration) {
                script.vars.push(s.generate(proc))
            } else if (s instanceof SimpleFunction) {
                script.functions.push(s.generate(proc))
            }
        }
        return script
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

    generate(proc: Processor): GenVarDeclaration {
        return new GenVarDeclaration(this.name.value,this.init?.generate(proc))
    }
    process(proc: Processor): void {
        proc.addVariable(this.name, this.init ? this.init.getResultType(proc) : SplashClass.object)
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

    generate(proc: Processor) {
        return this.values.map(v=>v.generate(proc))
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
            return binop.retType
        }
        proc.error(this.op.range, "Operator " + this.op.value + " cannot be applied to " + leftType)
        return SplashClass.object
    }

    generate(proc: Processor): GeneratedExpression {
        return new GeneratedBinary(this.left.generate(proc), this.op.value as BinaryOperator, this.right.generate(proc))
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
            return uop.retType
        }
        proc.error(this.op.range, "Operator " + this.op.value + " cannot be applied to " + type)
        return SplashClass.object
    }
    generate(proc: Processor): GeneratedExpression {
        return new GeneratedUnary(this.expr.generate(proc),this.op.value as UnaryOperator)
    }
}

export class LiteralExpression extends Expression {
    
    constructor(public token: Token) {
        super('literal_expression', token.range)
    }

    getResultType(proc: Processor): SplashType {
        switch (this.token.type) {
            case TokenType.int:
                return SplashInt.instance
            case TokenType.string:
                return SplashString.instance
        }
        return SplashClass.object
    }
    generate(proc: Processor): GeneratedExpression {
        return new GeneratedLiteral(this.token.type, this.token.value)
    }
}

export class InvalidExpression extends Expression {
    
    constructor() {
        super('invalid_expression', TextRange.end)
    }

    getResultType(proc: Processor): SplashType {
        return SplashClass.object
    }
    generate(proc: Processor): GeneratedExpression {
        return GeneratedLiteral.invalid
    }
}

export class ArrayExpression extends Expression {
    
    constructor(public values: ExpressionList) {
        super('array_expression', values.range)
    }

    getResultType(proc: Processor): SplashType {
        let valueType: SplashType = SplashClass.object
        for (let v of this.values.values) {
            let t = v.getResultType(proc)
            if (valueType == SplashClass.object) {
                valueType = t
            } else if (valueType != t) {
                if (valueType instanceof SplashComboType) {
                    valueType = new SplashComboType([t,...valueType.types])
                } else {
                    valueType = new SplashComboType([valueType,t])
                }
            }
        }
        return SplashArray.of(valueType)
    }
    generate(proc: Processor): GeneratedExpression {
        return new GenArrayCreation(this.values.generate(proc))
    }
    
}

export class Assignment extends Statement {
    
    constructor(public variable: AssignableExpression, public op: Token, public expression: Expression) {
        super("assignment",op.range)
    }

    process(proc: Processor): void {
        let v = this.variable.getResultType(proc)
        let val = this.expression.getResultType(proc)
        if (this.op.value == '=') {
            if (!val.canAssignTo(v)) {
                proc.error(this.expression.range, "Expression of type " + val + " cannot be assigned to " + v)
            }
        } else {
            let binop = this.op.value.substring(1) as BinaryOperator
            let opm = v.getBinaryOperation(binop, val)
            if (opm) {
                if (!opm.retType.canAssignTo(v)) {
                    proc.error(this.op.range, "Expression of type " + val + " cannot be assigned by applying operator " + this.op.value + " with " + v)
                }
            } else {
                proc.error(this.op.range, "Expression of type " + val + " cannot be applied to " + v + " with " + this.op.value)
            }
        }
    }
    generate(proc: Processor): GeneratedStatement {
        return new GenAssignment(this.variable.generate(proc), this.op.value as AssignmentOperator, this.expression.generate(proc))
    }
}

export abstract class AssignableExpression extends Expression {
    abstract generate(proc: Processor): GenAssignableExpression
}

export class FieldAccess extends AssignableExpression {
    
    constructor(public field: Token, public parent: Expression) {
        super("field_access",TextRange.between(parent.range, field.range))
    }

    getResultType(proc: Processor): SplashType {
        let parentType = this.parent.getResultType(proc)
        let m = parentType.getMembers(this.field.value)
        if (m.length > 0) {
            return new SplashComboType(m.map(f=>f.type))
        }
        proc.error(this.field.range, "Unknown member in type " + parentType)
        return SplashClass.object
    }
    generate(proc: Processor): GenAssignableExpression {
        return new GenFieldAccess(this.parent.generate(proc),this.field.value)
    }
}

export class VariableAccess extends AssignableExpression {
    
    constructor(public name: Token) {
        super("variable_access", name.range)
    }

    getResultType(proc: Processor): SplashType {
        let v = proc.getVariable(this.name.value);
        if (v) {
            return v.type
        } else {
            let func = proc.functions.find(f=>f.name.value == this.name.value)
            if (func) return func.toFunctionType(proc)
        }
        proc.error(this.name.range,"Unknown variable")
        return SplashClass.object
    }
    generate(proc: Processor): GenAssignableExpression {
        return new GenVarAccess(this.name.value)
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
            return invoker.retType
        }
        return SplashClass.object
    }
    generate(proc: Processor): GenCallAccess {
        return new GenCallAccess(this.parent.generate(proc), this.params.generate(proc))
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

export type Modifier = 'private'|'protected'|'abstract'|'native'|'final'|'static'|'readonly'|'operator'|'iterator'|'get'|'set'|'indexer'|'accessor'|'assigner'|'invoker'

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

export class ParameterNode extends ASTNode {

    constructor(public name: Token, public type: TypeToken, public defValue?: Expression, public vararg?: boolean) {
        super('parameter')
    }

    process(proc: Processor) {
        proc.validateType(this.type)
        if (this.vararg && this.defValue) {
            proc.error(this.name.range, "A parameter cannot be both vararg and have a default value")
        }
        if (this.defValue) {
            if (!this.type.canAccept(this.defValue.getResultType(proc))) {
                proc.error(this.defValue.range, "This expression cannot be assigned to this parameter's type")
            }
        }
    }

    generate(proc: Processor) {
        return new Parameter(this.name.value,proc.resolveType(this.type),this.defValue?.generate(proc),this.vararg)
    }

}

export class SimpleFunction extends Statement {
    
    constructor(public label: TextRange, public modifiers: ModifierList, public name: Token, public retType: TypeToken, public params: ParameterNode[], public code?: CodeBlock) {
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

    generate(proc: Processor): GenFunction {
        return new GenFunction(this.name.value,proc.resolveType(this.retType),this.params.map(p=>p.generate(proc)),this.code?.generate(proc))
    }

    toFunctionType(proc: Processor): SplashFunctionType {
        return new SplashFunctionType(this.params.map(p=>p.generate(proc).type),proc.resolveType(this.retType))
    }

}

export class ReturnStatement extends Statement {
    
    constructor(label: TextRange, public expr: Expression | undefined) {
        super('return',label)
    }

    process(proc: Processor): void {
        if (this.expr) {
            let type = this.expr?.getResultType(proc)
            if (proc.currentFunction) {
                if (!proc.currentFunction.retType.canAssignTo(type)) {
                    proc.error(this.expr?.range, "Expression does not match the function's return type")
                }
            }
        } else if (proc.currentFunction && proc.currentFunction.retType != DummySplashType.void) {
            proc.error(this.label, "Function should return a value")
        }
        proc.hasReturn = true
    }
    generate(proc: Processor): GeneratedStatement {
        return new GeneratedReturn(this.expr?.generate(proc))
    }
}

export class MethodNode extends Statement {

    index(proc: Processor) {
        if (proc.currentClass) {
            proc.currentClass.methods.push()
        }
    }

    process(proc: Processor): void {
        
    }
    generate(proc: Processor): GeneratedStatement {
        throw new Error("Method not implemented.");
    }
    
}

export class ClassDeclaration extends Statement {

    type: SplashClass

    constructor(public name: Token, public body: CodeBlock) {
        super('class_decl',name.range)
        this.type = new SplashClass(name.value)
    }

    index(proc: Processor) {
        if (proc.getTypeByName(this.name.value)) {
            proc.error(this.name.range, "Duplicate type " + this.name.value)
        } else {
            proc.types.push(this.type)
        }
    }

    process(proc: Processor): void {
        proc.currentClass = this.type
        this.body.index(proc)
        this.body.process(proc)
        proc.currentClass = undefined
    }
    generate(proc: Processor): GenClassDecl {
        return new GenClassDecl(this.type, this.body.generate(proc))
    }
    
}