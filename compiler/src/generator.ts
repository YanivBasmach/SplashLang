import { Expression } from "./ast";
import { Parameter, SplashClass, SplashComboType, SplashType, Value } from "./oop";
import { BinaryOperator, UnaryOperator } from "./operators";
import { SplashArray, SplashInt, SplashString } from "./primitives";
import { Returned, Runtime } from "./runtime";
import { TokenType } from "./tokenizer";


export abstract class Generated {

}

export abstract class GeneratedStatement extends Generated {

    abstract run(runtime: Runtime): void

}


export class GeneratedBlock extends GeneratedStatement {

    constructor(private statements: GeneratedStatement[]) {
        super()
    }

    run(runtime: Runtime) {
        try {
            for (let s of this.statements) {
                s.run(runtime)
            }
        } catch (r) {
            if (r instanceof Returned) {
                
            }
        }
    }
    
}


export class SplashScript extends Generated {

    functions: GenFunction[] = []
    vars: GenVarDeclaration[] = []

}

export class GenVarDeclaration extends GeneratedStatement {

    constructor(private name: string, private value?: GeneratedExpression) {
        super()
    }

    run(runtime: Runtime): void {
        runtime.declareVariable(this.name, this.value?.evaluate(runtime))
    }
    
}

export class GenFunction extends GeneratedStatement {

    constructor(public name: string, public retType: SplashType, public params: Parameter[], public body?: GeneratedBlock) {
        super()
    }

    run(runtime: Runtime): void {
        
    }

}

export abstract class GeneratedExpression extends Generated {

    abstract evaluate(runtime: Runtime): Value
}

export class GeneratedBinary extends GeneratedExpression {

    constructor(private left: GeneratedExpression, private op: BinaryOperator, private right: GeneratedExpression) {
        super()
    }

    evaluate(runtime: Runtime): Value {
        return this.left.evaluate(runtime).invokeBinOperator(runtime,this.op,this.right.evaluate(runtime))
    }

}

export class GenCallAccess extends GeneratedExpression {

    constructor(private expr: GeneratedExpression, private params: GeneratedExpression[]) {
        super()
    }

    evaluate(runtime: Runtime): Value {
        if (this.expr instanceof GenFieldAccess) {
            let fa = this.expr as GenFieldAccess
            return fa.expr.evaluate(runtime).invokeMethod(runtime,fa.field,...this.params.map(e=>e.evaluate(runtime)))
        } else if (this.expr instanceof GenVarAccess) {
            let va = this.expr as GenVarAccess
            return runtime.invokeFunction(va.name,...this.params.map(e=>e.evaluate(runtime)))
        }
        let val = this.expr.evaluate(runtime)
        return val.invoke(runtime, ...this.params.map(e=>e.evaluate(runtime)))
    }

}

export class GenCall extends GeneratedStatement {

    constructor(private call: GenCallAccess) {
        super()
    }

    run(runtime: Runtime): void {
        this.call.evaluate(runtime)
    }
    
}

export class GenFieldAccess extends GeneratedExpression {

    constructor(public expr: GeneratedExpression, public field: string) {
        super()
    }

    evaluate(runtime: Runtime): Value {
        return this.expr.evaluate(runtime).get(this.field)
    }
    
}

export class GenVarAccess extends GeneratedExpression {
    constructor(public name: string) {
        super()
    }

    evaluate(runtime: Runtime): Value {
        return runtime.getVariable(this.name)
    }
}

export class GeneratedUnary extends GeneratedExpression {
    constructor(private expr: GeneratedExpression, private op: UnaryOperator) {
        super()
    }
    evaluate(runtime: Runtime): Value {
        return this.expr.evaluate(runtime).invokeUnaryOperator(runtime,this.op)
    }
    
}

export class GeneratedLiteral extends GeneratedExpression {
    static invalid = new GeneratedLiteral(TokenType.invalid, "")

    constructor(public type: TokenType, public value: string) {
        super()
    }
    evaluate(runtime: Runtime): Value {
        switch (this.type) {
            case TokenType.int:
                return new Value(SplashInt.instance, parseInt(this.value))
            case TokenType.string:
                return new Value(SplashString.instance, this.value)
        }
        return Value.null
    }
    
}

export class GenStringLiteral extends GeneratedExpression {
    
    constructor(public nodes: GeneratedExpression[]) {
        super()
    }

    evaluate(runtime: Runtime): Value {
        let str = "";
        for (let n of this.nodes) {
            let v = n.evaluate(runtime)
            if (v.type == SplashString.instance) {
                str += v.inner
            } else {
                str += v.toString(runtime)
            }
        }
        return new Value(SplashString.instance, str)
    }
}

export class GenArrayCreation extends GeneratedExpression {
    constructor(public values: GeneratedExpression[]) {
        super()
    }
    evaluate(runtime: Runtime): Value {
        let vals = this.values.map(v=>v.evaluate(runtime))
        let valueType: SplashType = SplashClass.object
        for (let v of vals) {
            if (valueType == SplashClass.object) {
                valueType = v.type
            } else if (valueType != v.type) {
                if (valueType instanceof SplashComboType) {
                    valueType = new SplashComboType([v.type,...valueType.types])
                } else {
                    valueType = new SplashComboType([valueType,v.type])
                }
            }
        }
        return new Value(SplashArray.of(valueType), vals)
    }
    
}

export class GeneratedReturn extends GeneratedStatement {
    constructor(public expr?: GeneratedExpression) {
        super()
    }
    run(runtime: Runtime): void {
        runtime.returnValue = this.expr?.evaluate(runtime)
        throw new Returned()
    }
    
}