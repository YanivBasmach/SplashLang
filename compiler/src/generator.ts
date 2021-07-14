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

