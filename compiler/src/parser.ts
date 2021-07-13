import { CodeBlock, MainBlock, RootNode, Statement } from "./ast";
import { Token, Tokenizer, TokenType } from "./tokenizer";

export class Parser {

    lookforward: Token[] = []

    constructor(public file: string, public tokenizer: Tokenizer) {
        
    }

    next(skipComments = true): Token {
        if (this.lookforward.length > 0) {
            return this.lookforward.shift() || Token.EOF
        }
        let n = this.tokenizer.next()
        if (skipComments) {
            while (n.type == TokenType.comment) n = this.tokenizer.next()
        }
        return n
    }

    hasNext() {
        return this.tokenizer.canRead() || this.lookforward.length > 0
    }

    peek(count: number = 0, skipComments = true): Token {
        while (this.lookforward.length <= count && this.tokenizer.canRead()) {
            let n = this.tokenizer.next()
            if (skipComments) {
                while (n.type == TokenType.comment) n = this.tokenizer.next()
            }
            this.lookforward.push(n)
        }
        return this.lookforward[0] || Token.EOF
    }

    isNext(type: TokenType) {
        return this.peek().type == type
    }

    skip(type: TokenType) {
        if (this.isNext(type)) {
            this.next()
            return true
        }
        return false
    }

    isValueNext(val: string) {
        return this.peek().value === val
    }
    
    skipValue(val: string) {
        if (this.isValueNext(val)) {
            this.next()
            return true
        }
        return false
    }

    expect(type: TokenType) {
        if (this.skip(type)) {
            return true;
        }
        // error
        return false
    }

    parseFile(): RootNode {
        let root = new RootNode()

        while (this.hasNext()) {
            if (this.isNext(TokenType.keyword)) {
                let s = this.parseTopLevel()
                if (s) {
                    root.statements.push(s)
                }
            } else if (this.isNext(TokenType.line_end)) {
                this.next()
            } else {
                // error
            }
        }

        return root
    }

    parseTopLevel(): Statement {
        let kw = this.next()
        switch (kw.value) {
            case 'main':
                let block = this.parseBlock()
                if (block) {
                    return new MainBlock(kw.range,block.statements)
                }
                break
        }
    }

    parseBlock(): CodeBlock | undefined {
        if (this.isValueNext('{')) {
            let block = new CodeBlock('block',this.next().range)
            while (this.hasNext()) {
                if (this.isNext(TokenType.line_end)) {
                    this.next()
                    continue
                } else if (this.isValueNext('}')) {
                    break
                }
                let s = this.parseStatement()
                if (s) {
                    block.statements.push(s)
                }
            }

            this.expect(TokenType.line_end)
            return block
        }
        return undefined
    }

    parseStatement(): Statement {
        if (this.isValueNext('print')) {
            
        }
    }

}