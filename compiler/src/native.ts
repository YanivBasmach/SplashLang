import { Value } from "./oop";
import { DummySplashType, SplashString, SplashType } from "./types";
import { Runtime } from "./runtime";

interface NativeFunction {
    name: string
    retType: string
    params: string[]
    func: (r: Runtime, ...args: Value[])=>Value
}

export const nativeFunctionRegistry: NativeFunction[] = []

function Native(retType: string, ...params: string[]) {
    return function(target: any, propKey: string, descriptor: PropertyDescriptor) {
        nativeFunctionRegistry.push({
            name: propKey,
            retType,
            params,
            func: (r,...args)=>{
                return descriptor.value(r,...args)
            }
        })
    }
}


export class NativeFunctions {
    static instance = new NativeFunctions()

    static invokeMethod(runtime: Runtime, type: SplashType, name: string, params: Value[]): Value {
        return Value.null
    }

    static invokeFunction(runtime: Runtime, name: string, params: Value[]): Value {
        for (let nf of nativeFunctionRegistry) {
            if (nf.name == name) {
                return nf.func(runtime, ...params)
            }
        }
        return Value.null
    }

    @Native('void','string')
    print(runtime: Runtime, str: Value) {
        console.warn(str.inner)
    }
}

