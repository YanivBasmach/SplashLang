import { ClassDeclaration, MethodNode, RootNode, SimpleFunction } from "./ast";
import { GenFunction } from "./generator";
import { Method, SplashClass, SplashType, TypeToken } from "./oop";
import { TextRange, Token } from "./tokenizer";


export class Processor {

    variables: VariableFrame[] = [{}]
    types: SplashType[] = []
    functions: SimpleFunction[] = []
    currentClass: SplashClass | undefined
    currentFunction: GenFunction | Method | undefined
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

    getTypeByName(name: string) {
        return this.types.find(t=>t.name == name)
    }

    validateType(token: TypeToken) {

    }

    resolveType(token: TypeToken): SplashType {
        
    }

    getVariable(name: string) {
        for (let i = this.variables.length - 1; i >= 0; i++) {
            let frame = this.variables[i]
            if (frame[name]) {
                return frame[name]
            }
        }
    }

}

export type VariableFrame = {[id: string]: Variable}

export class Variable {
    constructor(public name: Token, public type: SplashType) {

    }
}