import { ClassDeclaration, MethodNode, ModifierList, ParameterNode, RootNode, SimpleFunction } from "./ast";
import { GenFunction, SplashScript } from "./generator";
import { BasicTypeToken, FunctionTypeToken, Method, SingleTypeToken, TypeToken } from "./oop";
import { DummySplashType, SplashArray, SplashClass, SplashComboType, SplashFunctionType, SplashInt, SplashString, SplashType } from "./types";
import { TextRange, Token } from "./tokenizer";
import { nativeFunctionRegistry, NativeFunctions } from "./native";


export class Processor {

    variables: VariableFrame[] = [{}]
    types: SplashType[] = []
    functions: SimpleFunction[] = []
    currentClass: SplashClass | undefined
    currentFunction: GenFunction | Method | undefined
    hasReturn = false
    hasErrors = false

    constructor(public root: RootNode, public file: string) {
        for (let f of nativeFunctionRegistry) { // todo: remove this and replace with reading of SDK
            this.functions.push(new SimpleFunction(TextRange.end,new ModifierList(),Token.dummy(f.name),TypeToken.dummy(f.retType),f.params.map(p=>{
                return new ParameterNode(Token.EOF,TypeToken.dummy(p))
            })))
        }
        this.types.push(SplashString.instance)
        this.types.push(SplashInt.instance)
        this.types.push(DummySplashType.void)
        this.types.push(DummySplashType.null)
        this.types.push(SplashClass.object)
        this.types.push(SplashArray.instance)
    }

    process() {
        this.root.process(this)
    }

    error(range: TextRange, msg: string) {
        console.log("Validation error at " + TextRange.toString(range) + ": " + msg)
        this.hasErrors = true
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

    resolveTypeFromSingle(token: SingleTypeToken): SplashType {
        if (token instanceof BasicTypeToken) {
            return this.types.find(t=>t.name == token.base.value) || DummySplashType.null
        } else if (token instanceof FunctionTypeToken) {
            return new SplashFunctionType(token.params.map(p=>p.generate(this)),this.resolveType(token.returnType))
        }
        return DummySplashType.null
    }

    resolveType(token: TypeToken): SplashType {
        if (token.options.length == 1) {
            let st = token.options[0]
            return this.resolveTypeFromSingle(st)
        }
        return new SplashComboType(token.options.map(t=>this.resolveTypeFromSingle(t)))
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