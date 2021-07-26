import { ModifierList, ParameterNode, RootNode, SimpleFunction } from "./ast";
import { GenFunction, SplashScript } from "./generator";
import { BasicTypeToken, FunctionTypeToken, Method, SingleTypeToken, TypeToken } from "./oop";
import { DummySplashType, resolveTypeBasic, SplashArray, SplashClass, SplashComboType, SplashFunctionType, SplashInt, SplashOptionalType, SplashParameterizedType, SplashString, SplashType } from "./types";
import { TextRange, Token } from "./tokenizer";
import { SplashModule } from "./env";


export class Processor {

    variables: VariableFrame[] = [{}]
    types: SplashType[] = []
    rawFunctions: SimpleFunction[] = []
    functions: GenFunction[] = []
    currentClass: SplashClass | undefined
    currentFunction: GenFunction | Method | undefined
    hasReturn = false
    hasErrors = false
    silent = false
    inInstanceContext = false

    constructor(public root: RootNode, public file: string) {
        
    }

    import(module: SplashModule) {
        for (let s of module.scripts) {
            this.importScript(s)
        }
    }

    importScript(script: SplashScript) {
        this.types.push(...script.classes)
        this.functions.push(...script.functions)
    }

    process() {
        this.root.process(this)
    }
    

    error(range: TextRange, msg: string) {
        if (!this.silent) {
            console.log("Validation error at " + TextRange.toString(range) + ": " + msg)
            this.hasErrors = true
        } else {
            console.log('skipped error, processor is silent (',msg,')')
        }
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
        if (token.toString() != 'null' && this.resolveType(token) == DummySplashType.null) {
            this.error(token.range,"Unknown type " + token)
        }
    }

    getFunctionType(name: string): SplashFunctionType | undefined {
        for (let f of this.functions) {
            if (f.name == name) return f.toFunctionType()
        }
        for (let f of this.rawFunctions) {
            if (f.name.value == name) return f.toFunctionType(this)
        }
    }

    resolveType(token: TypeToken): SplashType {
        return resolveTypeBasic(token,this.types,(n)=>n.generate(this),this.currentClass)
    }

    getVariable(name: string) {
        for (let i = this.variables.length - 1; i >= 0; i--) {
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