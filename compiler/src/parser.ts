import { TextRange, Token, Tokenizer } from "./tokenizer";

export class Parser {

    lookforward: Token[] = []

    constructor(public file: string, public tokenizer: Tokenizer) {

    }

    next(): Token {
        if (this.lookforward.length > 0) {
            return this.lookforward.shift() || Token.EOF
        }
        return this.tokenizer.next()
    }

    hasNext() {
        return this.tokenizer.canRead() || this.lookforward.length > 0
    }

    peek(count: number = 0): Token {
        while (this.lookforward.length <= count && this.tokenizer.canRead()) {
            this.lookforward.push(this.tokenizer.next())
        }
        return this.lookforward[0] || Token.EOF
    }

}