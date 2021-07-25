import { Modifier } from "./ast";
import { SplashScript } from "./generator";
import { nativeFunctionRegistry } from "./native";
import { Field, Parameter, Value } from "./oop";
import { SplashClass, SplashType } from "./types";


export class Runtime {

    currentClass: SplashClass | undefined
    currentInstance: Value | undefined
    returnValue: Value | undefined
    variables: {[name: string]: Value} = {}
    types: SplashType[] = []

    constructor(public script: SplashScript) {
        
    }

    copy() {
        let r = new Runtime(this.script)
        r.types = [...this.types]
        return r
    }

    declareVariable(name: string, value?: Value) {
        this.setVariable(name,value || Value.null)
    }

    setVariable(name: string, value: Value) {
        this.variables[name] = value
    }

    invokeFunction(name: string, ...params: Value[]): Value {
        if (this.currentClass) {
            let m = this.currentClass.getValidMethod(name,...params);
            if (m) {
                return m.invoke(this,this.currentInstance,...params)
            }
        }
        for (let f of this.script.functions) {
            if (f.name == name && Parameter.allParamsMatch(f.params, params)) {
                return f.invoke(this.copy(), ...params)
            }
        }
        for (let nf of nativeFunctionRegistry) {
            if (nf.name == name) {
                return nf.func(this.copy(), ...params)
            }
        }
        for (let t of this.types) {
            if (t instanceof SplashClass) {
                if (t.name == name) {
                    let ctor = t.getValidCtor(params)
                    if (ctor) return ctor.invoke(this, undefined, ...params)
                }
            }
        }
        return Value.null
    }

    getVariable(name: string): Value {
        if (this.currentClass) {
            for (let m of this.currentClass.getMembers(name)) {
                if (m instanceof Field && m.modifiers.has(Modifier.static)) {
                    return this.currentClass.staticFields[m.name]
                }
            }
        }
        if (this.currentInstance) {
            let f = this.currentInstance.get(this,name)
            if (f) {
                return f
            }
        }
        return this.variables[name]
    }

    inClassStatic(cls: SplashClass) {
        let r = this.copy()
        r.currentClass = cls
        r.types = [...this.types]
        return r;
    }

    inClassInstance(value: Value) {
        let r = this.copy()
        r.currentInstance = value
        if (value.type instanceof SplashClass) {
            r.currentClass = value.type
        }
        return r
    }
    
}


export class Returned extends Error {

}