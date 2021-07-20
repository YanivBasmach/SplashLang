
import { Native, NativeDelegate } from "./native"
import { Member, SplashParameterizedType, SplashType, Value } from "./oop"
import { Runtime } from "./runtime"

export class SplashFunctionType extends SplashType {

    constructor(public paramTypes: SplashType[], public retType: SplashType) {
        super()
    }

    get members(): Member[] {
        return []
    }
    
}

export abstract class SplashPrimitive extends SplashType {
    
    get members(): Member[] {
        return []
    }

    abstract get defaultValue(): Value
    
}

export class SplashInt extends SplashPrimitive {
    
    static instance = new SplashInt()
    
    get defaultValue(): Value {
        return new Value(this, 0)
    }
    
}

export class SplashArray extends SplashPrimitive {

    static instance = new SplashArray()

    get defaultValue(): Value {
        return new Value(this, [])
    }
    
    static of(type: SplashType) {
        return new SplashParameterizedType(SplashArray.instance,[type])
    }

    @Native()
    add(r: Runtime, arr: Value, obj: Value) {
        arr.inner.push(obj)
    }
}

export class SplashString extends SplashPrimitive {
    
    static instance = new SplashString()

    get defaultValue(): Value {
        return new Value(this, "")
    }

    @Native()
    charArray(r: Runtime, str: Value) {
        return new Value(SplashArray.of(this),(str.inner as string).split('').map(v=>new Value(this,v)))
    }

    @NativeDelegate
    toLowerCase() {}
}