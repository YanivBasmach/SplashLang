import { ExpressionList, ModifierList, ParameterNode } from "./ast";
import { GeneratedBlock, GeneratedExpression, SplashScript } from "./generator";
import { BinaryOperator, UnaryOperator } from "./operators";
import { Runtime } from "./runtime";
import { TextRange, Token } from "./tokenizer";
import { NativeMethods } from './native'
import { SplashFunctionType } from "./primitives";

export abstract class SingleTypeToken {
    constructor(public range: TextRange, public optional: boolean) {

    }
}

export class BasicTypeToken extends SingleTypeToken {
    constructor(public range: TextRange, public base: Token, public typeParams: TypeToken[], optional: boolean) {
        super(range, optional)
    }
}

export class FunctionTypeToken extends SingleTypeToken {
    constructor(public range: TextRange, public params: ParameterNode[], public returnType: TypeToken, optional: boolean) {
        super(range, optional)
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

}


export abstract class SplashType {

    get methods(): Method[] {
        return this.members.filter(m=>m instanceof Method).map(m=>m as Method)
    }

    get defaultValue(): Value {
        return Value.null
    }

    abstract get members(): Member[]

    getBinaryOperation(op: BinaryOperator, right: SplashType): Method | undefined {
        let name = Object.entries(BinaryOperator).find(e=>e[1] == op)?.[0] || ''
        let methods = this.getMethods(name)
        for (let m of methods) {
            if (m.modifiers.has('operator') && m.params[0] && m.params[0].type == right) {
                return m
            }
        }
    }

    getUnaryOperation(op: UnaryOperator): Method | undefined {
        let name = Object.entries(UnaryOperator).find(e=>e[1] == op)?.[0] || ''
        let methods = this.getMethods(name)
        for (let m of methods) {
            if (m.modifiers.has('operator')) {
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

    getInvoker(params: ExpressionList): Method | undefined {
        let methods = this.getMethods('invoker')
        for (let m of methods) {
            if (m.modifiers.has('invoker') && params.canApplyTo(m.params)) {
                return m
            }
        }
    }

    getValidMethod(name: string, ...params: Value[]) {
        return this.getMethods(name)
            .filter(m=>allParamsMatch(m.params,params))[0]
    }

}

export class DummySplashType extends SplashType {
    static void = new DummySplashType('void')
    static null = new DummySplashType('null')

    constructor(public name: string) {
        super()
    }
    get members(): Member[] {
        return []
    }
    
}

export class SplashClass extends SplashType {
    static object = new SplashClass('object')

    private _members: Member[] = []

    staticFields: {[name: string]: Value} = {}

    constructor(public name: string) {
        super()
    }

    get members() {
        return this._members
    }
}

export class SplashParameterizedType extends SplashType {
    

    constructor(public base: SplashType, public params: SplashType[]) {
        super()
    }

    get members(): Member[] {
        return this.base.members
    }
    
}

export class SplashComboType extends SplashType {

    constructor(public types: SplashType[]) {
        super()
    }

    get members(): Member[] {
        return this.types.map(t=>t.members).reduce((prev,curr)=>prev.concat(curr),[])
    }

}

export interface Member {
    name: string
    type: SplashType
}

export abstract class ClassExecutable {

    constructor(public cls: SplashClass, public params: Parameter[], public modifiers: ModifierList) {

    }

    abstract invoke(runtime: Runtime, thisArg?: Value, ...params: Value[]): Value

}

export class Method extends ClassExecutable implements Member {
    

    type: SplashType

    constructor(cls: SplashClass, public name: string, public retType: SplashType, params: Parameter[], modifiers: ModifierList, public body?: GeneratedBlock) {
        super(cls,params,modifiers)
        this.type = new SplashFunctionType(this.params.map(p=>p.type),this.retType)
    }

    invoke(runtime: Runtime, thisArg?: Value, ...params: Value[]): Value {
        let r: Runtime
        if (this.modifiers.has('static')) {
            r = runtime.inClassStatic(this.cls)
        } else if (thisArg) {
            r = runtime.inClassInstance(thisArg)
        } else {
            return Value.null
        }
        for (let i = 0; i < params.length; i++) {
            let pv = params[i]
            let p = Parameter.getParamAt(i,this.params)
            if (p) {
                r.setVariable(p.name,pv)
            }
        }
        if (this.body) {
            this.body?.run(r)
        } else {
            NativeMethods.invoke(r, this.cls, this.name, params)
        }
        return r.returnValue || Value.void
    }

}

export class Parameter {
    constructor(public name: string, public type: SplashType, public defValue?: GeneratedExpression, public vararg?: boolean) {

    }

    static getParamAt(index: number, params: Parameter[]) {
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
}

export class Constructor extends ClassExecutable {

    constructor(cls: SplashClass, params: Parameter[], modifiers: ModifierList, public body: GeneratedBlock) {
        super(cls,params,modifiers)
    }

    invoke(runtime: Runtime, thisArg?: Value, ...params: Value[]): Value {
        let r = runtime.inClassStatic(this.cls)
        let val = new Value(this.cls,{})
        let newRt = r.inClassInstance(val)
        for (let m of this.cls.members) {
            if (m instanceof Field) {
                val.set(m.name,m.defaultValue(r))
            }
        }
        
        Parameter.initParams(newRt, this.params, params)
        this.body.run(newRt)
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
        let methods = this.type.getValidMethod(name,...params)
        
        return methods.invoke(runtime,this,...params)
    }

    invoke(runtime: Runtime, ...params: Value[]) {
        let invoker = this.type.getMethods('invoker')
            .filter(m=>m.modifiers.has('invoker'))
            .filter(m=>allParamsMatch(m.params, params))
        
        return invoker[0].invoke(runtime,this,...params)
    }

    get(field: string) {
        return this.inner[field]
    }

    set(field: string, value: Value) {
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
        return this.invokeMethod(runtime, 'toString')
    }
}

export function allParamsMatch(params: Parameter[], values: Value[]) {

}