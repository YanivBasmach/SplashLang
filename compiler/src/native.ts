import { SplashType, Value } from "./oop";
import { SplashArray } from "./primitives";
import { Runtime } from "./runtime";

export function Native(isStatic: boolean = false) {
    return function(target: any, propKey: string, descriptor: PropertyDescriptor) {

    }
}


export function NativeDelegate(target: any, propKey: string, descriptor: PropertyDescriptor) {

}

export class NativeMethods {

    static invoke(runtime: Runtime, type: SplashType, name: string, params: Value[]) {
        
    }
}