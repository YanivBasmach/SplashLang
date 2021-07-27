import { ModifierList, ParameterNode, RootNode, FunctionNode, ASTNode } from "./ast";
import { SplashFunction, SplashScript } from "./generator";
import { BasicTypeToken, FunctionTypeToken, Method, SingleTypeToken, TypeToken } from "./oop";
import { BuiltinTypes, DummySplashType, SelfSplashType, SplashComboType, SplashFunctionType, SplashInt, SplashOptionalType, SplashParameterizedType, SplashString, SplashType } from "./types";
import { BaseTokenizer, TextRange, Token } from "./tokenizer";
import { SplashModule } from "./env";
import { Parser } from "./parser";


export class Processor {

    variables: VariableFrame[] = [{}]
    types: SplashType[] = []
    rawFunctions: FunctionNode[] = []
    functions: SplashFunction[] = []
    currentClass: SplashType | undefined
    currentFunction: SplashFunction | Method | undefined
    hasReturn = false
    hasErrors = false
    silent = false
    inInstanceContext = false

    constructor() {
        this.types.push(...Object.values(BuiltinTypes))
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

    importAST(ast: RootNode) {
        this.types.push(...ast.classes.map(c=>c.type))
        this.rawFunctions.push(...ast.functions)
    }

    process(ast: RootNode) {
        ast.process(this)
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
        if (this.currentClass) {
            for (let m of this.currentClass.methods) {
                if (m.name == name) return m.type
            }
        }
        for (let f of this.functions) {
            if (f.name == name) return f.toFunctionType()
        }
        for (let f of this.rawFunctions) {
            if (f.name.value == name) return f.toFunctionType(this)
        }
    }

    resolveType(token: TypeToken): SplashType {
        if (token.options.length == 1) {
            let st = token.options[0]
            return this.resolveTypeFromSingle(st) || DummySplashType.null
        }
        return new SplashComboType(token.options.map(t=>this.resolveTypeFromSingle(t)))
    }

    resolveTypeFromSingle(token: SingleTypeToken): SplashType {
        if (token instanceof BasicTypeToken) {
            let t = this.getTypeByName(token.base.value)
            if (t) {
                if (token.typeParams.length > 0) {
                    let hasInvalid = false
                    let params = token.typeParams.map(p=>{
                        let rt = this.resolveType(p)
                        if (!rt) hasInvalid = true
                        return rt
                    })
                    if (hasInvalid) return DummySplashType.null
                    t = new SplashParameterizedType(t,params)
                }
                return token.optional ? SplashOptionalType.of(t) : t
            } else if (token.base.value == 'this' && this.currentClass) {
                return new SelfSplashType(this.currentClass)
            }
        } else if (token instanceof FunctionTypeToken) {
            let f = new SplashFunctionType(token.params.map(p=>p.generate(this)), this.resolveType(token.returnType))
            return token.optional ? SplashOptionalType.of(f) : f
        }
        return DummySplashType.null
    }

    resolveTypeFromString(str: string) {
        let token = new Parser('unknown',new BaseTokenizer(str)).parseTypeToken(true)
        if (!token) return
        return this.resolveType(token)
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