import { SplashScript } from "./generator";
import { Field, SplashClass, Value } from "./oop";


export class Runtime {

    currentClass: SplashClass | undefined
    currentInstance: Value | undefined
    returnValue: Value | undefined
    variables: {[name: string]: Value} = {}

    constructor(public script: SplashScript) {
        
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
        this.script.functions
    }

    getVariable(name: string): Value {
        if (this.currentClass) {
            for (let m of this.currentClass.getMembers(name)) {
                if (m instanceof Field && m.modifiers.has('static')) {
                    return this.currentClass.staticFields[m.name]
                }
            }
        }
        if (this.currentInstance) {
            let f = this.currentInstance.get(name)
            if (f) {
                return f
            }
        }
        return this.variables[name]
    }

    inClassStatic(cls: SplashClass) {
        let r = new Runtime(this.script)
        r.currentClass = cls
        return r;
    }

    inClassInstance(value: Value) {
        let r = new Runtime(this.script)
        r.currentInstance = value
        if (value.type instanceof SplashClass) {
            r.currentClass = value.type
        }
        return r
    }
    
}


export class Returned extends Error {

}