import { RootNode, SimpleFunction } from "./ast";
import { SplashType } from "./oop";
import { TextRange, Token } from "./tokenizer";


export class Processor {

    variables: VariableFrame[] = [{}]
    types: SplashType[] = []
    functions: SimpleFunction[] = []

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

}

export type VariableFrame = {[id: string]: Variable}

export class Variable {
    constructor(public name: Token, public type: SplashType) {

    }
}