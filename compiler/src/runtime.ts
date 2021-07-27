import { SplashModule } from "./env";
import { SplashFunction, SplashScript } from "./generator";
import { nativeFunctions, NativeFunctions } from "./native";
import { Field, Parameter, Value } from "./oop";
import { Modifier } from "./operators";
import { SplashClass, SplashType } from "./types";

export class Runtime {

    currentType: SplashType | undefined
    currentInstance: Value | undefined
    returnValue: Value | undefined
    
    variables: {[name: string]: Value} = {}
    types: SplashType[] = []
    functions: SplashFunction[] = []

    copy() {
        let r = new Runtime()
        r.types = [...this.types]
        r.functions = [...this.functions]
        return r
    }

    include(script: SplashScript) {
        this.types.push(...script.classes)
        this.functions.push(...script.functions)
    }

    includeModule(module: SplashModule) {
        for (let s of module.scripts) {
            this.include(s)
        }
    }

    declareVariable(name: string, value?: Value) {
        this.setVariable(name,value || Value.null)
    }

    setVariable(name: string, value: Value) {
        this.variables[name] = value
    }

    invokeFunction(name: string, ...params: Value[]): Value {
        if (this.currentType) {
            let m = this.currentType.getValidMethod(name,...params);
            if (m) {
                return m.invoke(this,this.currentType,this.currentInstance,...params)
            }
        }
        for (let f of this.functions) {
            if (f.name == name && Parameter.allParamsMatch(f.params, params.map(p=>p.type))) {
                return f.invoke(this.copy(), ...params)
            }
        }
        for (let nf of nativeFunctions) {
            if (nf.name == name && Parameter.allParamsMatch(nf.params, params.map(p=>p.type))) {
                return nf.run(this.copy(), ...params)
            }
        }
        for (let t of this.types) {
            if (t instanceof SplashClass) {
                if (t.name == name) {
                    let ctor = t.getValidCtor(params)
                    if (ctor) return ctor.invoke(this, t, undefined, ...params)
                }
            }
        }
        return Value.null
    }

    getVariable(name: string): Value {
        if (this.variables[name]) return this.variables[name]
        if (this.currentType) {
            for (let m of this.currentType.getMembers(name,)) {
                if (m instanceof Field && m.modifiers.has(Modifier.static)) {
                    return this.currentType.staticFields[m.name]
                }
            }
        }
        if (this.currentInstance) {
            if (name == 'this') {
                return this.currentInstance
            }
            let f = this.currentInstance.get(this,name)
            if (f) {
                return f
            }
        }
        return Value.null
    }

    inTypeStatic(type?: SplashType) {
        let r = this.copy()
        r.currentType = type
        r.types = [...this.types]
        return r;
    }

    inTypeInstance(value: Value) {
        let r = this.copy()
        r.currentInstance = value
        r.currentType = value.type
        return r
    }
    
}


export class Returned extends Error {
    constructor() {
        super('returned')
    }
}