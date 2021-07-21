import { SplashType, Value } from "./oop";
import { SplashArray } from "./primitives";
import { Runtime } from "./runtime";

export interface NativeFunction {
    inType?: SplashType
    func: (r: Runtime, val: Value, ...args: Value[])=>Value
}

const nativeFunctionRegistry: NativeFunction[] = []

export function Native(isStatic: boolean = false) {
    return function(target: any, propKey: string, descriptor: PropertyDescriptor) {
        
    }
}


export function NativeDelegate(target: any, propKey: string, descriptor: PropertyDescriptor) {

}

export class NativeFunctions {
    static instance = new NativeFunctions()

    static invokeMethod(runtime: Runtime, type: SplashType, name: string, params: Value[]): Value {

    }

    static invokeFunction(runtime: Runtime, name: string, params: Value[]): Value {

    }
}