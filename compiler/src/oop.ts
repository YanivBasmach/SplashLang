import { ExpressionList, ModifierList, ParameterNode } from "./ast";
import { GeneratedExpression } from "./generator";
import { BinaryOperator, UnaryOperator } from "./operators";
import { Runtime } from "./runtime";
import { TextRange, Token } from "./tokenizer";


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

}

export class SplashClass extends SplashType {
    static object = new SplashClass('object')

    private _members: Member[] = []

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

export class SplashFunctionType extends SplashType {

    constructor(public paramTypes: SplashType[], public retType: SplashType) {
        super()
    }

    get members(): Member[] {
        return []
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

    constructor(public params: Parameter[], public modifiers: ModifierList) {

    }

    invoke(runtime: Runtime, ...params: Value[]): Value {

    }

}

export class Method extends ClassExecutable implements Member {

    type: SplashType

    constructor(public name: string, public retType: SplashType, params: Parameter[], modifiers: ModifierList) {
        super(params,modifiers)
        this.type = new SplashFunctionType(this.params.map(p=>p.type),this.retType)
    }

    

}

export class Parameter {
    constructor(public name: string, public type: SplashType, public defValue?: GeneratedExpression, public vararg?: boolean) {

    }
}

export class Constructor extends ClassExecutable {

}

export class Value {
    fields: {[name: string]: Value} = {}

    constructor(public type: SplashType) {

    }

    invokeMethod(runtime: Runtime, name: string, ...params: Value[]): Value {
        let methods = this.type.getMethods(name)
            .filter(m=>allParamsMatch(m.params,params))
        
        return methods[0].invoke(runtime,...params)
    }

    invoke(runtime: Runtime, ...params: Value[]) {
        let invoker = this.type.getMethods('invoker')
            .filter(m=>m.modifiers.has('invoker'))
            .filter(m=>allParamsMatch(m.params, params))
        
        return invoker[0].invoke(runtime,...params)
    }

    get(field: string) {
        return this.fields[field]
    }
}

export function allParamsMatch(params: Parameter[], values: Value[]) {

}