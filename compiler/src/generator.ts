import { Value } from "./oop";
import { Runtime } from "./runtime";


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
        for (let s of this.statements) {
            s.run(runtime)
        }
    }
    
}


export class SplashScript extends GeneratedBlock {

    

}

export class GenVarDeclaration extends GeneratedStatement {

    constructor(private name: string, private value?: GeneratedExpression) {
        super()
    }

    run(runtime: Runtime): void {
        runtime.declareVariable(this.name, this.value?.evaluate(runtime))
    }
    
}

export class GeneratedExpression extends Generated {
    evaluate(runtime: Runtime): Value {

    }
}

export class GenCallAccess extends GeneratedExpression {

}

export class GenCall extends GeneratedStatement {

    constructor(private call: GenCallAccess) {
        super()
    }

    run(runtime: Runtime): void {
        
    }
    
}