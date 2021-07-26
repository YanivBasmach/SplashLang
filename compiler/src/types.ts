

import { ExpressionList, ParameterNode } from "./ast"
import { NativeMethods } from "./native"
import { BasicTypeToken, Constructor, Field, FunctionTypeToken, Member, Method, Parameter, SingleTypeToken, TypeToken, Value } from "./oop"
import { BinaryOperator, Modifier, UnaryOperator } from "./operators"
import { Parser } from "./parser"
import { Processor } from "./processor"
import { Runtime } from "./runtime"
import { BaseTokenizer, TextRange, Token } from "./tokenizer"

export abstract class SplashType {

    protected _members: Member[] = []
    staticFields: {[name: string]: Value} = {}

    constructor(public name: string) {

    }
    
    get methods(): Method[] {
        return this.members.filter(m=>m instanceof Method).map(m=>m as Method)
    }

    get defaultValue(): Value {
        return Value.null
    }

    get members(): Member[] {
        let m = [...this._members]
        if (!(this instanceof SplashClass) || this != SplashClass.object) {
            m.push(...this.super.members)
        }
        return m
    }

    get super(): SplashType {
        return SplashClass.object
    }

    addMember(m: Member) {
        if (!this._members) {
            this._members = []
        }
        this._members.push(m)
    }

    toToken() {
        return new TypeToken([new BasicTypeToken(TextRange.end,Token.dummy(this.name),[],false)])
    }

    getBinaryOperation(op: BinaryOperator, right: SplashType): Method | undefined {
        console.log('getting binop',op,'in',this.toString(),'with',right.toString())
        console.log('methods:',this.methods)
        let name = Object.entries(BinaryOperator).find(e=>e[1] == op)?.[0] || ''
        let methods = this.getMethods(name)
        for (let m of methods) {
            if (m.modifiers.has(Modifier.operator) && m.params[0] && right.canAssignTo(m.params[0].type)) {
                return m
            }
        }
    }

    getUnaryOperation(op: UnaryOperator): Method | undefined {
        let name = Object.entries(UnaryOperator).find(e=>e[1] == op)?.[0] || ''
        let methods = this.getMethods(name)
        for (let m of methods) {
            if (m.modifiers.has(Modifier.operator)) {
                return m
            }
        }
    }

    getMethods(name: string) {
        return this.methods.filter(m=>m.name == name)
    }

    getMembers(name: string) {
        return this.members.filter(m=>m.name == name)
    }

    getField(name: string) {
        return this.members.find(m=>m instanceof Field && m.name == name)
    }

    getInvoker(proc: Processor, params: ExpressionList): Method | undefined {
        for (let m of this.methods) {
            if (m.modifiers.has(Modifier.invoker) && params.canApplyTo(proc,m.params)) {
                return m
            }
        }
    }

    getValidMethod(name: string, ...params: Value[]) {
        return this.getMethods(name)
            .filter(m=>Parameter.allParamsMatch(m.params,params.map(p=>p.type)))[0]
    }

    canAssignTo(type: SplashType): boolean {
        if (type == SplashClass.object) return true
        if (this == type) return true
        if (type instanceof SplashOptionalType) {
            return this == type.inner
        }
        if (type instanceof SplashParameterizedType) {
            return this.canAssignTo(type.base)
        }
        return false
    }

    toString() {
        return this.name
    }
}

export class SplashFunctionType extends SplashType {

    constructor(public params: Parameter[], public retType: SplashType) {
        super('function')
    }

    get members(): Member[] {
        return []
    }

    toToken() {
        return new TypeToken([new FunctionTypeToken(TextRange.end, this.params.map(p=>new ParameterNode(Token.dummy(p.name),p.type.toToken())),this.retType.toToken(),false)])
    }

    toString() {
        return 'function(' + this.params.map(p=>p.type.toString() + ' ' + p.name).join(',') + '): ' + this.retType.toString() 
    }
    
}

export abstract class SplashPrimitive extends SplashType {
    
    abstract get defaultValue(): Value

}

export class SplashInt extends SplashPrimitive {
    
    static instance = new SplashInt('int')
    
    get defaultValue(): Value {
        return new Value(this, 0)
    }
    
}

export class SplashArray extends SplashPrimitive {

    static instance = new SplashArray('array')

    get defaultValue(): Value {
        return new Value(this, [])
    }
    
    static of(type: SplashType) {
        return new SplashParameterizedType(SplashArray.instance,[type])
    }
}

export class SplashString extends SplashPrimitive {
    
    static instance = new SplashString('string')

    get defaultValue(): Value {
        return new Value(this, "")
    }
}

export class DummySplashType extends SplashType {
    static void = new DummySplashType('void')
    static null = new DummySplashType('null')

    constructor(name: string) {
        super(name)
    }
    get members(): Member[] {
        return []
    }
    
}

export class SplashClass extends SplashType {
    static object = new SplashClass('object')

    constructor(name: string) {
        super(name)
    }

    get constructors(): Constructor[] {
        return this._members.filter(m=>m instanceof Constructor).map(m=>m as Constructor)
    }

    getValidCtor(params: Value[]) {
        return this.constructors.find(c=>Parameter.allParamsMatch(c.params,params.map(p=>p.type)))
    }
}

export class SplashParameterizedType extends SplashType {
    

    constructor(public base: SplashType, public params: SplashType[]) {
        super(base.name)
    }

    get members(): Member[] {
        return this.base.members
    }

    canAssignTo(type: SplashType) {
        if (type instanceof SplashParameterizedType) {
            console.log(this.base,type)
            let base = this.base.canAssignTo(type)
            let sl = this.params.length == type.params.length 
            let pm = false
            if (sl) {
                pm = this.params.every((t,i)=>t == type.params[i])
            }
            return base && sl && pm
        }
        return this.base.canAssignTo(type)
    }

    getInvoker(proc: Processor, params: ExpressionList) {
        return this.base.getInvoker(proc, params)
    }
    
    toString() {
        return this.base.toString() + '<' + this.params.join(',') + '>'
    }

}

export class SplashComboType extends SplashType {

    constructor(public types: SplashType[]) {
        super('union')
    }

    get members(): Member[] {
        return this.types.map(t=>t.members).reduce((prev,curr)=>prev.concat(curr),[])
    }

    canAssignTo(type: SplashType) {
        return this.types.find(t=>t.canAssignTo(type)) !== undefined
    }

}

export class SplashOptionalType extends SplashType {

    constructor(public inner: SplashType) {
        super('optional')
    }

    get members(): Member[] {
        return this.inner.members
    }

    toString() {
        return this.inner.toString() + '?'
    }

    canAssignTo(type: SplashType) {
        return type instanceof SplashOptionalType && this.inner.canAssignTo(type.inner)
    }

    static of(type: SplashType) {
        return new SplashOptionalType(type)
    }
    
}

export class SplashClassType extends SplashClass {

    static instance = new SplashClassType()

    constructor() {
        super('Class')
    }

    static of(type: SplashType) {
        return new SplashParameterizedType(SplashClassType.instance,[type])
    }
}

export function resolveTypeBasic(token: TypeToken, types: SplashType[], paramGen?: (node: ParameterNode)=>Parameter, currentType?: SplashType): SplashType {
    if (token.options.length == 1) {
        let st = token.options[0]
        return resolveTypeFromSingle(st,types,paramGen,currentType) || DummySplashType.null
    }
    return new SplashComboType(token.options.map(t=>resolveTypeFromSingle(t,types,paramGen,currentType)))
}

function resolveTypeFromSingle(token: SingleTypeToken, types: SplashType[], paramGen?: (node: ParameterNode)=>Parameter, currentType?: SplashType): SplashType {
    if (token instanceof BasicTypeToken) {
        let t = types.find(t=>t.name == token.base.value)
        if (t) {
            if (token.typeParams.length > 0) {
                let hasInvalid = false
                let params = token.typeParams.map(p=>{
                    let rt = resolveTypeBasic(p,types,paramGen)
                    if (!rt) hasInvalid = true
                    return rt
                })
                if (hasInvalid) return DummySplashType.null
                t = new SplashParameterizedType(t,params)
            }
            return token.optional ? SplashOptionalType.of(t) : t
        } else if (token.base.value == 'this' && currentType) {
            return currentType
        }
    } else if (token instanceof FunctionTypeToken) {
        let f = new SplashFunctionType(token.params.map(p=>paramGen ? paramGen(p) : undefined).filter(p=>p !== undefined) as Parameter[],resolveTypeBasic(token.returnType,types,paramGen))
        return token.optional ? SplashOptionalType.of(f) : f
    }
    return DummySplashType.null
}

export function resolveTypeFromString(str: string, types: SplashType[], currentType?: SplashType) {
    let token = new Parser('unknown',new BaseTokenizer(str)).parseTypeToken(true)
    if (!token) return
    return resolveTypeBasic(token,types,(n)=>new Parameter(n.name.value,resolveTypeBasic(n.type,types,undefined)),currentType)
}