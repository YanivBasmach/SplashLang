import { ExpressionList, Modifier, ModifierList, ParameterNode } from "./ast";
import { GeneratedBlock, GeneratedExpression, SplashScript } from "./generator";
import { BinaryOperator, UnaryOperator } from "./operators";
import { Runtime } from "./runtime";
import { TextRange, Token } from "./tokenizer";
import { DummySplashType, SplashClass, SplashFunctionType, SplashPrimitive, SplashString, SplashType } from "./types";
import { NativeFunctions } from "./native";

export abstract class SingleTypeToken {
    constructor(public range: TextRange, public optional: boolean) {

    }

    abstract toString(): string
}

export class BasicTypeToken extends SingleTypeToken {
    constructor(public range: TextRange, public base: Token, public typeParams: TypeToken[], optional: boolean) {
        super(range, optional)
    }

    toString() {
        return this.base.value + (this.typeParams.length == 0 ? '' : '<' + this.typeParams.join(',') + '>') + (this.optional ? '?' : '')
    }
}

export class FunctionTypeToken extends SingleTypeToken {
    constructor(public range: TextRange, public params: ParameterNode[], public returnType: TypeToken, optional: boolean) {
        super(range, optional)
    }

    toString() {
        return '(' + this.params.map(p=>p.type.toString() + ' ' + p.name).join(', ') + ')=>' + this.returnType.toString()
    }
}


export class TypeToken {

    static void = new TypeToken([new BasicTypeToken(TextRange.end,Token.dummy('void'),[],false)])
    static object = new TypeToken([new BasicTypeToken(TextRange.end,Token.dummy('object'),[],false)])

    constructor(public options: SingleTypeToken[]) {

    }

    get range(): TextRange {
        return this.options.length == 0 ? TextRange.end :
                TextRange.between(this.options[0].range, this.options[this.options.length - 1].range)
    }

    canAccept(type: SplashType) {
        return true
    }

    static dummy(name: string) {
        return new TypeToken([new BasicTypeToken(TextRange.end,Token.dummy(name),[],false)])
    }

    toString() {
        return this.options.join(' | ')
    }

}

export interface Member {
    name: string
    type: SplashType
}

export abstract class ClassExecutable implements Member {

    constructor(public cls: SplashClass, public params: Parameter[], public modifiers: ModifierList) {

    }
    abstract name: string;
    abstract type: SplashType;

    abstract invoke(runtime: Runtime, thisArg?: Value, ...params: Value[]): Value

}

export class Method extends ClassExecutable {
    
    body?: GeneratedBlock
    type: SplashType

    constructor(cls: SplashClass, public name: string, public retType: SplashType, params: Parameter[], modifiers: ModifierList) {
        super(cls,params,modifiers)
        this.type = new SplashFunctionType(this.params,this.retType)
    }

    invoke(runtime: Runtime, thisArg?: Value, ...params: Value[]): Value {
        let r: Runtime
        if (this.modifiers.has(Modifier.static)) {
            r = runtime.inClassStatic(this.cls)
        } else if (thisArg) {
            r = runtime.inClassInstance(thisArg)
        } else {
            return Value.null
        }
        if (this.body) {
            for (let i = 0; i < params.length; i++) {
                let pv = params[i]
                let p = Parameter.getParamAt(i,this.params)
                if (p) {
                    r.setVariable(p.name,pv)
                }
            }
            this.body.run(r)
            return r.returnValue || Value.void
        } else {
            return NativeFunctions.invokeMethod(r, this.cls, this.name, params)
        }
        
    }

}

export class Parameter {
    constructor(public name: string, public type: SplashType, public defValue?: GeneratedExpression, public vararg?: boolean) {

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
            } else {
                runtime.setVariable(p.name, p.defValue?.evaluate(runtime) || Value.null)
            }
        }
    }

    static allParamsMatch(params: Parameter[], values: Value[]) {
        for (let i = 0; i < values.length; i++) {
            let v = values[i]
            let p = Parameter.getParamAt(i,params)
            if (p) {
                if (!v.type.canAssignTo(p.type)) return false
            } else {
                return false
            }
        }
        return true
    }
}

export class CtorParameter extends Parameter {
    constructor(name: string, type: SplashType, public assignToField: boolean, defValue?: GeneratedExpression, public vararg?: boolean) {
        super(name,type,defValue,vararg)
    }
}

export class Constructor extends ClassExecutable {

    body?: GeneratedBlock
    type: SplashType
    name: string = 'constructor'
    constructor(cls: SplashClass, params: CtorParameter[], modifiers: ModifierList) {
        super(cls,params,modifiers)
        this.type = new SplashFunctionType(this.params,this.cls)
    }

    invoke(runtime: Runtime, thisArg?: Value, ...params: Value[]): Value {
        let r = runtime.inClassStatic(this.cls)
        let val = new Value(this.cls,{})
        let newRt = r.inClassInstance(val)
        for (let m of this.cls.members) {
            if (m instanceof Field) {
                val.set(newRt,m.name,m.defaultValue(r))
            }
        }
        
        Parameter.initParams(newRt, this.params, params)
        for (let i = 0; i < params.length; i++) {
            let v = params[i]
            let cp = Parameter.getParamAt(i,this.params)
            if (cp instanceof CtorParameter && cp.assignToField) {
                val.set(newRt,cp.name,v)
            }
        }
        this.body?.run(newRt)
        return val
    }

}

export class Field implements Member {
    constructor(public name: string, public modifiers: ModifierList, public type: SplashType, public init?: GeneratedExpression) {

    }

    defaultValue(runtime: Runtime): Value {
        return this.init ? this.init.evaluate(runtime) : this.type.defaultValue
    }
}

export class Value {

    static dummy = new Value(SplashClass.object,{})
    static void = new Value(DummySplashType.void,undefined)
    static null = new Value(DummySplashType.null,null)

    constructor(public type: SplashType, public inner: any) {
        
    }

    invokeMethod(runtime: Runtime, name: string, ...params: Value[]): Value {
        let method = this.type.getValidMethod(name,...params)
        
        return method.invoke(runtime,this,...params)
    }

    invoke(runtime: Runtime, ...params: Value[]) {
        let invoker = this.type.methods.filter(m=>m.modifiers.has(Modifier.invoker))
            .filter(m=>Parameter.allParamsMatch(m.params, params))
        
        return invoker[0].invoke(runtime,this,...params)
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

    get(runtime: Runtime, field: string) {
        let acc = this.getAccessor()
        if (acc) {
            return acc.invoke(runtime, this, new Value(SplashString.instance, field))
        }
        return this.inner[field]
    }

    set(runtime: Runtime, field: string, value: Value) {
        let ass = this.getAssigner(value.type)
        if (ass) {
            ass.invoke(runtime, this, new Value(SplashString.instance, field), value)
        }
        this.inner[field] = value
    }

    invokeBinOperator(runtime: Runtime, op: BinaryOperator, other: Value): Value {
        let method = this.type.getBinaryOperation(op,other.type)
        return method?.invoke(runtime, this, other) || Value.dummy
    }

    invokeUnaryOperator(runtime: Runtime, op: UnaryOperator): Value {
        let method = this.type.getUnaryOperation(op)
        return method?.invoke(runtime, this) || Value.dummy
    }

    toString(runtime: Runtime) {
        if (this.type instanceof SplashPrimitive) {
            return this.inner.toString()
        }
        console.log('invoking toString of',this.type,':',this.inner)
        return this.invokeMethod(runtime, 'toString').inner
    }

    toBoolean(runtime: Runtime): boolean {
        if (this.type instanceof SplashPrimitive) {
            return this.inner ? true : false
        }
        return this.invokeMethod(runtime, 'toBoolean').inner
    }
}
