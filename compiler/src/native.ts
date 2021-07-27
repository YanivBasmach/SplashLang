import { Method, Parameter, Value } from "./oop";
import { Modifier } from "./operators";
import { Runtime } from "./runtime";
import { BuiltinTypes, SplashClass, SplashInt, SplashString, SplashType } from "./types";
import * as readline from 'readline-sync'
import { ModifierList } from "./ast";
import { Processor } from "./processor";

interface UnbakedNativeFunction {
    name: string
    retType: string
    params?: string[]
    run: (r: Runtime, ...params: Value[])=>Value
}

export interface NativeFunction {
    name: string
    retType: SplashType
    params: Parameter[]
    run: (r: Runtime, ...params: Value[])=>Value
}

function NativeFunction(retType: string, params?: string[]) {
    return function(target: any, key: string, desc: PropertyDescriptor) {
        unbakedFunctions.push({
            name: key,
            retType,
            params,
            run: desc.value
        })
    }
}
const unbakedFunctions: UnbakedNativeFunction[] = []
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

    static init(proc: Processor) {
        for (let u of unbakedFunctions) {
            nativeFunctions.push({
                name: u.name,
                retType: proc.resolveTypeFromString(u.retType) || SplashClass.object,
                params: u.params?.map(p=>Parameter.readFromString(p,proc)) || [],
                run: u.run
            })
        }
        
    }

    @NativeFunction('void',['object msg'])
    print(r: Runtime, msg: Value) {
        console.log(">> " + msg.toString(r))
    }

    @NativeFunction('string',['string? query'])
    readLine(r: Runtime, msg: Value) {
        if (msg.isNull) {
            return new Value(SplashString.instance, readline.prompt())
        }
        return new Value(SplashString.instance, readline.question(msg.inner + '\n'))
    }

    @NativeFunction('int')
    randomUID(r: Runtime) {
        return new Value(SplashInt.instance, Math.round(Math.random() * 100000))
    }

}

interface UnbakedNativeMethod {
    name: string
    type: string
    retType: string
    params?: string[]
    modifiers?: Modifier[]
    run: (r: Runtime, thisArg?: Value, ...params: Value[])=>Value
}

export interface NativeMethod {
    name: string
    type: SplashType
    retType: SplashType
    params: Parameter[]
    run: (r: Runtime, thisArg?: Value, ...params: Value[])=>Value
}

function NativeMethod(retType: string, params?: string[], modifiers?: Modifier[]) {
    return function(target: any, key: string, desc: PropertyDescriptor) {
        let type = key.substring(0,key.indexOf('_'))
        let name = key.substring(key.indexOf('_') + 1)
        unbakedMethods.push({
            name,
            type,
            retType,
            params,
            modifiers,
            run: desc.value
        })
    }
}

const unbakedMethods: UnbakedNativeMethod[] = []
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

    static init(proc: Processor) {
        for (let u of unbakedMethods) {
            let inType = proc.resolveTypeFromString(u.type) || SplashClass.object
            proc.currentClass = inType
            let ret = proc.resolveTypeFromString(u.retType) || SplashClass.object
            let par = u.params?.map(p=>Parameter.readFromString(p,proc,inType)) || []
            proc.currentClass = undefined
            inType.addMember(new Method(u.name,ret,par,new ModifierList(u.modifiers)))
            console.log('added native method ' + u.name + ' to',inType.toString())
            nativeMethods.push({
                name: u.name,
                type: inType,
                retType: ret,
                params: par,
                run: u.run
            })
        }
    }

    @NativeMethod('this',['this def'],[Modifier.operator])
    object_default(r: Runtime, val: Value, other: Value) {
        return val.isNull ? other : val
    }

    @NativeMethod('string')
    string_toLowerCase(r: Runtime, val: Value) {
        return new Value(SplashString.instance,val.inner.toLowerCase())
    }

    @NativeMethod('boolean',['int other'],[Modifier.operator])
    int_equals(r: Runtime, val: Value, other: Value) {
        return new Value(BuiltinTypes.boolean,val.inner == other.inner)
    }

    @NativeMethod('int',['int other'],[Modifier.operator])
    int_mod(r: Runtime, val: Value, other: Value) {
        return new Value(BuiltinTypes.int,val.inner % other.inner)
    }

    @NativeMethod('int',[],[Modifier.operator])
    int_negative(r: Runtime, val: Value) {
        return new Value(SplashInt.instance, -val.inner)
    }

    @NativeMethod('boolean',[],[Modifier.operator])
    boolean_not(r: Runtime, val: Value) {
        return new Value(BuiltinTypes.boolean,!val.inner)
    }

}