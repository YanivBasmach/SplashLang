import { ExpressionList, ModifierList, ParameterNode, RootNode } from "./ast";
import { GeneratedBlock, GeneratedExpression, SplashScript } from "./generator";
import { BinaryOperator, Modifier, transformOperatorResult, UnaryOperator } from "./operators";
import { Runtime } from "./runtime";
import { BaseTokenizer, TextRange, Token } from "./tokenizer";
import { DummySplashType, SplashClass, SplashClassType, SplashFunctionType, SplashOptionalType, SplashParameterizedType, SplashPrimitive, SplashString, SplashType } from "./types";
import { NativeFunctions, NativeMethods } from "./native";
import { Parser } from "./parser";
import { Processor } from "./processor";

export abstract class TypeToken {

    optional = false

    constructor() {

    }

    abstract get range(): TextRange

    abstract toString(): string

}

export abstract class SingleTypeToken extends TypeToken {
    constructor(public range: TextRange) {
        super()
    }
    
}

export class BasicTypeToken extends SingleTypeToken {

    static void = new BasicTypeToken(TextRange.end,Token.dummy('void'),[])
    static object = new BasicTypeToken(TextRange.end,Token.dummy('object'),[])

    constructor(public range: TextRange, public base: Token, public typeParams: TypeToken[]) {
        super(range)
    }

    toString() {
        return this.base.value + (this.typeParams.length == 0 ? '' : '<' + this.typeParams.join(',') + '>') + (this.optional ? '?' : '')
    }
}

export class FunctionTypeToken extends SingleTypeToken {
    constructor(public range: TextRange, public params: ParameterNode[], public returnType: TypeToken, optional: boolean) {
        super(range)
        this.optional = optional
    }

    toString() {
        return '(' + this.params.map(p=>p.type.toString() + ' ' + p.name).join(', ') + ')=>' + this.returnType.toString()
    }
}

export class ComboTypeToken extends TypeToken {
    
    constructor(public options: TypeToken[]) {
        super()
    }

    get range(): TextRange {
        return TextRange.between(this.options[0].range,this.options[this.options.length-1].range)
    }
    toString(): string {
        return this.options.join(' | ')
    }
}




export interface Member {
    name: string
    type: SplashType
    isStatic: boolean
}

export abstract class ClassExecutable implements Member {

    constructor(public params: Parameter[], public modifiers: ModifierList) {

    }
    abstract name: string;
    abstract type: SplashType;
    abstract get isStatic(): boolean

    abstract invoke(runtime: Runtime, inType: SplashType, thisArg?: Value, ...params: Value[]): Value

}

export class Method extends ClassExecutable {
    
    body?: GeneratedBlock
    type: SplashFunctionType

    constructor(public name: string, public retType: SplashType, params: Parameter[], modifiers: ModifierList) {
        super(params,modifiers)
        this.type = new SplashFunctionType(this.retType, this.params)
    }

    invoke(runtime: Runtime, inType: SplashType, thisArg?: Value, ...params: Value[]): Value {
        let r: Runtime
        if (this.modifiers.has(Modifier.static)) {
            r = runtime.inTypeStatic(inType)
        } else if (thisArg) {
            r = runtime.inTypeInstance(thisArg)
        } else {
            return Value.null
        }
        if (this.body) {
            Parameter.initParams(r,this.params,params)
            this.body.run(r)
            return r.returnValue || Value.void
        } else {
            return NativeMethods.invoke(r, inType, this.name, params, thisArg)
        }
        
    }

    get isStatic() {
        return this.modifiers.has(Modifier.static)
    }

}

export class Parameter {
    defValue?: GeneratedExpression
    constructor(public name: string, public type: SplashType, public hasDefValue?: boolean, public vararg?: boolean) {

    }

    static getParamAt(index: number, params: Parameter[]) {
        if (params.length == 0) return
        if (index < params.length) {
            return params[index]
        }
        if (params[params.length - 1].vararg) {
            return params[params.length - 1]
        }
    }

    static initParams(runtime: Runtime, params: Parameter[], values: Value[]) {
        for (let i = 0; i < params.length; i++) {
            let p = params[i]
            if (p.vararg) {
                let vals = values.slice(i,values.length)
                runtime.setVariable(p.name, new Value(p.type, vals))
            } else if (i < values.length) {
                runtime.setVariable(p.name, values[i])
            } else if (p.type instanceof SplashOptionalType) {
                runtime.setVariable(p.name, new Value(p.type, null))
            } else {
                let val = p.defValue?.evaluate(runtime) || Value.null
                runtime.setVariable(p.name, val)
            }
        }
    }

    static allParamsMatch(params: Parameter[], types: SplashType[]): boolean {
        let matchCount = 0;
        for (let i = 0; i < params.length; i++) {
            let p = params[i]
            if (i < types.length) {
                if (p.vararg) {
                    let rest = types.slice(i)
                    return rest.every(r=>r.canAssignTo((p.type as SplashParameterizedType).params[0]))
                } else {
                    if (!types[i].canAssignTo(p.type)) {
                        return false
                    }
                }
                matchCount++
            } else if (!(p.type instanceof SplashOptionalType) && !p.hasDefValue) {
                return false
            }
            
        }
        return matchCount == types.length;
    }

    static readFromString(str: string, proc: Processor, inType?: SplashType) {
        let parser = new Parser('unknown',new BaseTokenizer(str))
        let p = parser.parseParameter()
        if (!p) throw 'Cannot create parameter from ' + str
        p.process(proc)
        return p.generate(proc)
    }
}

export class CtorParameter extends Parameter {
    constructor(name: string, type: SplashType, public assignToField: boolean, hasDefValue?: boolean, public vararg?: boolean) {
        super(name,type,hasDefValue,vararg)
    }
}

export class Constructor extends ClassExecutable {

    body?: GeneratedBlock
    type: SplashType
    name: string = 'constructor'
    constructor(type: SplashType, params: CtorParameter[], modifiers: ModifierList) {
        super(params,modifiers)
        this.type = new SplashFunctionType(type, this.params)
    }

    invoke(runtime: Runtime, inType: SplashType, thisArg?: Value, ...params: Value[]): Value {
        let val = new Value(inType,{})
        let r = runtime.inTypeInstance(val)
        for (let m of inType.members) {
            if (m instanceof Field) {
                val.set(r,m.name,m.defaultValue(r))
            }
        }
        
        Parameter.initParams(r, this.params, params)
        for (let i = 0; i < this.params.length; i++) {
            let cp = this.params[i]
            let v = r.getVariable(cp.name)
            if (cp instanceof CtorParameter && cp.assignToField) {
                val.set(r,cp.name,v)
            }
        }
        this.body?.run(r)
        return val
    }

    get isStatic() {
        return true
    }

}

export class Field implements Member {
    constructor(public name: string, public modifiers: ModifierList, public type: SplashType, public init?: GeneratedExpression) {

    }

    defaultValue(runtime: Runtime): Value {
        return this.init ? this.init.evaluate(runtime) : this.type.defaultValue
    }

    get isStatic() {
        return this.modifiers.has(Modifier.static)
    }
}

export class Value {

    static dummy = new Value(SplashClass.object,{})
    static void = new Value(DummySplashType.void,undefined)
    static null = new Value(DummySplashType.null,null)

    constructor(public type: SplashType, public inner: any) {
        
    }

    invokeMethod(runtime: Runtime, name: string, ...params: Value[]): Value {
        let method = this.type.getValidMethod(name,...params.map(p=>p.type))
        if (!method) {
            console.log('could not find method',name,params,'in',this)
        }
        return method.invoke(runtime,this.type,this,...params)
    }

    invoke(runtime: Runtime, ...params: Value[]) {
        let invoker = this.type.methods.filter(m=>m.modifiers.has(Modifier.invoker))
            .filter(m=>Parameter.allParamsMatch(m.params, params.map(v=>v.type)))
        
        return invoker[0].invoke(runtime,this.type,this,...params)
    }

    getAccessor() {
        return this.type.methods.filter(m=>m.modifiers.has(Modifier.accessor))
            .filter(m=>m.params.length == 1 && m.params[0].type == SplashString.instance)
            [0]
    }

    getAssigner(type: SplashType) {
        return this.type.methods.filter(m=>m.modifiers.has(Modifier.assigner))
            .filter(m=>m.params.length == 2 
                && m.params[0].type == SplashString.instance
                && type.canAssignTo(m.params[1].type))
            [0]
    }

    get(runtime: Runtime, field: string): Value {
        let acc = this.getAccessor()
        if (acc) {
            return acc.invoke(runtime, this.type, this, new Value(SplashString.instance, field))
        }
        if (this.isPrimitive) {
            return Value.null
        }
        
        return this.inner[field]
    }

    set(runtime: Runtime, field: string, value: Value) {
        let ass = this.getAssigner(value.type)
        if (ass) {
            ass.invoke(runtime, this.type, this, new Value(SplashString.instance, field), value)
        }
        if (!this.isPrimitive) {
            this.inner[field] = value
        }
    }

    getIndex(runtime: Runtime, index: Value) {
        let indexer = this.type.getIndexGetter(index.type)
        if (indexer) {
            return indexer.invoke(runtime, this.type, this, index)
        }
    }

    setIndex(runtime: Runtime, index: Value, value: Value) {
        let indexer = this.type.getIndexSetter(index.type,value.type)
        if (indexer) {
            indexer.invoke(runtime, this.type, this, index, value)
        }
    }

    invokeBinOperator(runtime: Runtime, op: BinaryOperator, other: Value): Value {
        let method = this.type.getBinaryOperation(op,other.type)
        if (!method) {
            console.log('did not find bin operator',this,op,other)
            return Value.dummy
        }
        let res = method.invoke(runtime, this.type, this, other)
        return transformOperatorResult(res, method.name, op)
    }

    invokeUnaryOperator(runtime: Runtime, op: UnaryOperator): Value {
        let method = this.type.getUnaryOperation(op)
        return method?.invoke(runtime, this.type, this) || Value.dummy
    }

    toString(runtime: Runtime): string {
        if (this.isPrimitive) {
            if (this.isNull) {
                return 'null'
            }
            return this.inner.toString()
        }
        return this.invokeMethod(runtime, 'toString').inner
    }

    toBoolean(runtime: Runtime): boolean {
        if (this.isPrimitive) {
            return this.inner ? true : false
        }
        return this.invokeMethod(runtime, 'toBoolean').inner
    }

    get isNull() {
        return this.type == DummySplashType.null || this.inner == null
    }

    get isVoid() {
        return this.type == DummySplashType.void
    }

    get isPrimitive() {
        return this.type instanceof SplashPrimitive || this.isNull || this.isVoid
    }
}
