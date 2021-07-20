import { RootNode, SimpleFunction } from "./ast";
import { SplashType, TypeToken } from "./oop";
import { TextRange, Token } from "./tokenizer";


export class Processor {

    variables: VariableFrame[] = [{}]
    types: SplashType[] = []
    functions: SimpleFunction[] = []
    currentFunction: SimpleFunction | MethodNode | undefined
    hasReturn = false

    constructor(public root: RootNode) {

    }

    process() {
        this.root.process(this)
    }

    error(range: TextRange, msg: string) {
        console.log("Validation error at " + TextRange.toString(range) + ": " + msg)
    }

    push() {
        this.variables.push({})
    }

    pop() {
        this.variables.pop()
    }

    addVariable(name: Token, type: SplashType) {
        if (this.variables.length > 0) {
            this.variables[this.variables.length-1][name.value] = new Variable(name, type)
        }
    }

    validateType(token: TypeToken) {

    }

    resolveType(token: TypeToken): SplashType {
        
    }

}

export type VariableFrame = {[id: string]: Variable}

export class Variable {
    constructor(public name: Token, public type: SplashType) {

    }
}