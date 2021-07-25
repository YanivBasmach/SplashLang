

import { ExpressionList, Modifier, ModifierList, ParameterNode, SimpleFunction } from "./ast"
import { BasicTypeToken, Constructor, Field, FunctionTypeToken, Member, Method, Parameter, TypeToken, Value } from "./oop"
import { BinaryOperator, UnaryOperator } from "./operators"
import { Processor } from "./processor"
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
            if (m.modifiers.has(Modifier.operator) && m.params[0] && m.params[0].type == right) {
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
            .filter(m=>Parameter.allParamsMatch(m.params,params))[0]
    }

    canAssignTo(type: SplashType) {
        return this == type
    }

    toString() {
        return 'Type:' + this.name
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

    get constructors(): Constructor[] {
        return this._members.filter(m=>m instanceof Constructor).map(m=>m as Constructor)
    }

    addMember(m: Member) {
        this._members.push(m)
    }

    getValidCtor(params: Value[]) {
        return this.constructors.find(c=>Parameter.allParamsMatch(c.params,params))
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

    getInvoker(proc: Processor, params: ExpressionList) {
        return this.base.getInvoker(proc, params)
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

export class SplashClassType extends SplashClass {

    private static instance = new SplashClassType()

    constructor() {
        super('Class')
    }

    static of(type: SplashType) {
        return new SplashParameterizedType(SplashClassType.instance,[type])
    }
}