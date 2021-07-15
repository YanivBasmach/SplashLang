import { ExpressionList, ModifierList, Parameter } from "./ast";
import { BinaryOperator } from "./operators";
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
    constructor(public range: TextRange, public params: Parameter[], public returnType: TypeToken, optional: boolean) {
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


export class SplashType {
    static object = new SplashType()

    methods: Method[] = []
    constructors: Constructor[] = []

    getBinaryOperation(op: BinaryOperator, right: SplashType): Method | undefined {
        let name = Object.entries(BinaryOperator).find(e=>e[1] == op)?.[0] || ''
        let methods = this.getMethods(name)
        for (let m of methods) {
            if (m.modifiers.has('operator') && m.params[0] && m.params[0].type.canAccept(right)) {
                return m
            }
        }
    }

    getMethods(name: string) {
        return this.methods.filter(m=>m.name == name)
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

export abstract class ClassExecutable {

    constructor(public params: Parameter[], public modifiers: ModifierList) {

    }

}

export class Method extends ClassExecutable {

    constructor(public name: string, public retType: TypeToken, params: Parameter[]) {
        super(params)
    }

}

export class Constructor extends ClassExecutable {

}

export class Value {
    fields: {name: string, value: Value}[] = []

    constructor(public type: SplashType) {

    }
}