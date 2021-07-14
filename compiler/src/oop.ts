import { Parameter } from "./ast";
import { Token } from "./tokenizer";


export class TypeToken {
    
    constructor(public options: SingleTypeToken[]) {

    }

}

export abstract class SingleTypeToken {
    constructor(public optional: boolean) {

    }
}

export class BasicTypeToken extends SingleTypeToken {
    constructor(public base: Token, public typeParams: TypeToken[], optional: boolean) {
        super(optional)
    }
}

export class FunctionTypeToken extends SingleTypeToken {
    constructor(public params: Parameter[], public returnType: TypeToken, optional: boolean) {
        super(optional)
    }
}