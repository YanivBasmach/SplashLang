

import { ExpressionList, ParameterNode } from "./ast"
import { BasicTypeToken, FunctionTypeToken, Member, Method, Parameter, TypeToken, Value } from "./oop"
import { BinaryOperator, UnaryOperator } from "./operators"
import { Runtime } from "./runtime"
import { TextRange, Token } from "./tokenizer"

interface NativeMethod {
    type: SplashType
    name: string
    func: (r: Runtime, val: Value, ...args: Value[])=>Value
}

const nativeMethodRegistry: NativeMethod[] = []

function Native(isStatic: boolean = false) {
    return function(target: any, propKey: string, descriptor: PropertyDescriptor) {
        if (target instanceof SplashType) {
            nativeMethodRegistry.push({
                type: target,
                name: propKey,
                func: (r,v,...args)=>{
                    return descriptor.value(r,v,...args)
                }
            })
        }
        
    }
}

function NativeDelegate(target: any, propKey: string, descriptor: PropertyDescriptor) {

}


export abstract class SplashType {

    constructor(public name: string) {

    }

    get methods(): Method[] {
        return this.members.filter(m=>m instanceof Method).map(m=>m as Method)
    }

    get defaultValue(): Value {
        return Value.null
    }

    abstract get members(): Member[]

    toToken() {
        return new TypeToken([new BasicTypeToken(TextRange.end,Token.dummy(this.name),[],false)])
    }

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
            .filter(m=>Parameter.allParamsMatch(m.params,params))[0]
    }

    canAssignTo(type: SplashType) {
        return this == type
    }

}

export class SplashFunctionType extends SplashType {

    constructor(public paramTypes: SplashType[], public retType: SplashType) {
        super('function')
    }

    get members(): Member[] {
        return []
    }

    toToken() {
        return new TypeToken([new FunctionTypeToken(TextRange.end, this.paramTypes.map(t=>new ParameterNode(Token.EOF,t.toToken())),this.retType.toToken(),false)])
    }
    
}

export abstract class SplashPrimitive extends SplashType {
    
    get members(): Member[] {
        return []
    }

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

    @Native()
    add(r: Runtime, arr: Value, obj: Value) {
        arr.inner.push(obj)
    }
}

export class SplashString extends SplashPrimitive {
    
    static instance = new SplashString('string')

    get defaultValue(): Value {
        return new Value(this, "")
    }

    @Native()
    chars(r: Runtime, str: Value) {
        return new Value(SplashArray.of(this),(str.inner as string).split('').map(v=>new Value(this,v)))
    }

    @NativeDelegate
    toLowerCase() {}
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

    private _members: Member[] = []

    staticFields: {[name: string]: Value} = {}

    constructor(name: string) {
        super(name)
    }

    get members() {
        return this._members
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
        return this.base.canAssignTo(type)
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