import { Method, Parameter, Value } from "./oop";
import { Modifier } from "./operators";
import { Runtime } from "./runtime";
import { DummySplashType, resolveTypeFromString, SplashArray, SplashClass, SplashClassType, SplashInt, SplashString, SplashType } from "./types";
import * as readline from 'readline-sync'
import { ModifierList } from "./ast";


export const builtinTypes = [
    SplashString.instance,
    SplashInt.instance,
    SplashArray.instance,
    SplashClass.object,
    SplashClassType.instance,
    DummySplashType.null,
    DummySplashType.void
]


export interface NativeFunction {
    name: string
    retType: SplashType
    params: Parameter[]
    run: (r: Runtime, ...params: Value[])=>Value
}

function NativeFunction(retType: string, params?: string[]) {
    return function(target: any, key: string, desc: PropertyDescriptor) {
        nativeFunctions.push({
            name: key,
            retType: resolveTypeFromString(retType,builtinTypes) || SplashClass.object,
            params: params?.map(p=>Parameter.readFromString(p,builtinTypes)) || [],
            run: desc.value
        })
    }
}

export const nativeFunctions: NativeFunction[] = []

export class NativeFunctions {

    
    static invoke(r: Runtime, name: string, params: Value[]) {
        for (let e of nativeFunctions) {
            if (e.name == name && Parameter.allParamsMatch(e.params,params.map(p=>p.type))) {
                return e.run(r,...params)
            }
        }
        console.log('no native function found named ' + name)
        return Value.null
    }

    @NativeFunction('void',['object msg'])
    static print(r: Runtime, msg: Value) {
        console.warn(msg.toString(r))
    }

    @NativeFunction('string',['string? query'])
    static inputLine(r: Runtime, msg: Value) {
        if (msg.isNull) {
            return new Value(SplashString.instance, readline.prompt())
        }
        return new Value(SplashString.instance, readline.question(msg.inner))
    }

}

export interface NativeMethod {
    name: string
    type: SplashType
    retType: SplashType
    params: Parameter[]
    run: (r: Runtime, thisArg?: Value, ...params: Value[])=>Value
}

function NativeMethod(type: string, retType: string, params?: string[], modifiers?: Modifier[]) {
    return function(target: any, key: string, desc: PropertyDescriptor) {
        let inType = resolveTypeFromString(type,builtinTypes) || SplashClass.object
        let ret = resolveTypeFromString(retType,builtinTypes,inType) || SplashClass.object
        let par = params?.map(p=>Parameter.readFromString(p,builtinTypes,inType)) || []
        inType.addMember(new Method(key,ret,par,new ModifierList(modifiers)))
        nativeMethods.push({
            name: key,
            type: inType,
            retType: ret,
            params: par,
            run: desc.value
        })
    }
}

const nativeMethods: NativeMethod[] = []

export class NativeMethods {

    static invoke(r: Runtime, type: SplashType, name: string, params: Value[], thisArg?: Value) {
        let e = NativeMethods.findMethod(type,name,params.map(p=>p.type))
        if (e) {
            return e.run(r,thisArg,...params)
        }
        console.log('no native method found in ' + type + ' named ' + name)
        return Value.null
    }

    static findMethod(type: SplashType, name: string, paramTypes: SplashType[]) {
        for (let e of nativeMethods) {
            if (type.canAssignTo(e.type) && e.name == name && Parameter.allParamsMatch(e.params,paramTypes)) {
                return e
            }
        }
    }

    @NativeMethod('object','self',['self def'],[Modifier.operator])
    static default(r: Runtime, val: Value, other: Value) {
        return val.isNull ? other : val
    }

    @NativeMethod('string','string')
    static toLowerCase(r: Runtime, val: Value) {
        return new Value(SplashString.instance,val.inner.toLowerCase())
    }

}