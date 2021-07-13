import { AccessNode, AssignableAccessNode, Assignment, BinaryExpression, CallAccess, CallStatement, CodeBlock, Expression, FieldAccess, InvalidExpression, LiteralExpression, MainBlock, RootNode, Statement, VarDeclaration, VariableRootAccess } from "./ast";
import { AssignmentOperator, BinaryOperator } from "./operators";
import { TextRange, Token, Tokenizer, TokenType } from "./tokenizer";

export class Parser {

    lookforward: Token[] = []
    lastToken: Token | undefined

    constructor(public file: string, public tokenizer: Tokenizer) {
        
    }

    error(token: Token, msg: string) {
        console.log('Compilation error at ' + TextRange.toString(token.range) + ': ' + msg)
    }

    next(skipComments = true): Token {
        if (this.lookforward.length > 0) {
            return this.lookforward.shift() || Token.EOF
        }
        let n = this.tokenizer.next()
        if (skipComments) {
            while (n.type == TokenType.comment) n = this.tokenizer.next()
        }
        this.lastToken = n
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

    isValueNext(...val: string[]) {
        let peeked = this.peek().value
        for (let v of val) {
            if (v === peeked) return true
        }
        return false
    }
    
    skipValue(val: string) {
        if (this.isValueNext(val)) {
            this.next()
            return true
        }
        return false
    }

    expect(type: TokenType): Token | undefined {
        if (this.isNext(type)) {
            return this.next();
        }
        this.error(this.peek(),'Expected ' + TokenType[type])
        return undefined
    }

    expectValue(val: string): Token | undefined {
        if (this.isValueNext(val)) {
            return this.next();
        }
        this.error(this.peek(),'Expected ' + val)
        return undefined
    }

    expectOneOf(name: string, ...values: string[]): Token {
        for (let v of values) {
            if (this.isValueNext(v)) return this.next()
        }
        // error
        return Token.invalid(this.peek().range)
    }

    parseFile(): RootNode {
        let root = new RootNode()

        while (this.hasNext()) {
            if (this.isNext(TokenType.keyword)) {
                let s = this.parseTopLevel()
                if (s) {
                    root.statements.push(s)
                    this.expect(TokenType.line_end)
                } else {
                    while (this.hasNext() && !this.isNext(TokenType.line_end)) {
                        this.next()
                    }
                }
            } else if (this.isNext(TokenType.line_end)) {
                this.next()
            } else {
                // error
            }
        }

        return root
    }

    parseTopLevel(): Statement | undefined {
        let kw = this.next()
        switch (kw.value) {
            case 'var':
                return this.parseVarDecl()
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
                    this.expect(TokenType.line_end)
                } else {
                    while (this.hasNext() && !this.isNext(TokenType.line_end)) {
                        this.next()
                    }
                }
            }

            this.expect(TokenType.line_end)
            return block
        }
        return undefined
    }

    parseStatement(): Statement | undefined {
        if (this.isNext(TokenType.identifier)) {
            return this.parseVarAccess()
        } else if (this.isValueNext('var')) {
            return this.parseVarDecl()
        }
    }

    parseVarDecl(): Statement | undefined {
        let tok = this.next()
        let name = this.expect(TokenType.identifier)
        if (name) {
            let expr: Expression | undefined
            if (this.skipValue('=')) {
                expr = this.parseExpression()
            }
            return new VarDeclaration(tok.range, name, expr)
        }
    }

    parseVarAccess(): Statement | undefined {
        let v = this.next()
        let access = this.parseAccessChain(new VariableRootAccess(v))
        if (access instanceof AssignableAccessNode) {
            let assignOp = this.expectOneOf('assignment operator',...Object.values(AssignmentOperator))
            let value = this.parseExpression()
            return new Assignment(access, assignOp.range, assignOp.value, value)
        } else if (access instanceof CallAccess) {
            return new CallStatement(access, this.lastToken?.range || TextRange.end)
        }
        this.error(this.peek(),'Cannot assign to this expression')
    }

    parseAccessChain(parent: AccessNode): AccessNode {
        if (this.skipValue('.')) {
            let field = this.expect(TokenType.identifier)
            if (field) {
                return this.parseAccessChain(new FieldAccess(field, parent))
            }
        } else if (this.skipValue('(')) {
            let args = this.parseExpressionList(')');
            return this.parseAccessChain(new CallAccess(args, parent))
        }
        return parent
    }

    parseExpressionList(end: string): Expression[] {
        let list: Expression[] = []
        while (this.hasNext() && !this.isValueNext(end)) {
            list.push(this.parseExpression())
            this.expectValue(',')
        }
        this.expectValue(end)
        return list
    }

    parseExpression(): Expression {
        let expr = this.parseOrExpression()
        while (this.skipValue('&&')) {
            expr = new BinaryExpression(expr,BinaryOperator.and,this.parseOrExpression());
        }
        return expr
    }

    parseOrExpression(): Expression {
        let expr = this.parseEqualityExpression()
        while (this.isValueNext('||')) {
            expr = new BinaryExpression(expr,BinaryOperator.or,this.parseEqualityExpression());
        }
        return expr
    }

    parseEqualityExpression(): Expression {
        let expr = this.parseComparisonExpression()
        while (this.isValueNext('==','!=')) {
            expr = new BinaryExpression(expr,this.next().value,this.parseComparisonExpression());
        }
        return expr
    }

    parseComparisonExpression(): Expression {
        let expr = this.parseAdditiveExpression()
        while (this.isValueNext('<','>','<=','>=')) {
            expr = new BinaryExpression(expr,this.next().value,this.parseAdditiveExpression());
        }
        return expr
    }

    parseAdditiveExpression(): Expression {
        let expr = this.parseMultiExpression()
        while (this.isValueNext('+','-')) {
            expr = new BinaryExpression(expr,this.next().value,this.parseMultiExpression());
        }
        return expr
    }

    parseMultiExpression(): Expression {
        let expr = this.parsePowExpression()
        while (this.isValueNext('*','/','//','%')) {
            expr = new BinaryExpression(expr,this.next().value,this.parsePowExpression());
        }
        return expr
    }

    parsePowExpression(): Expression {
        let expr = this.parseAsIsInExpression()
        while (this.isValueNext('**')) {
            expr = new BinaryExpression(expr,this.next().value,this.parseAsIsInExpression());
        }
        return expr
    }

    parseAsIsInExpression(): Expression {
        let expr = this.parsePrimaryExpression()
        while (this.isValueNext('as','is','in')) {
            expr = new BinaryExpression(expr,this.next().value,this.parsePrimaryExpression());
        }
        return expr
    }

    parsePrimaryExpression(): Expression {
        if (this.isNext(TokenType.int) || this.isNext(TokenType.string) || this.isNext(TokenType.float)) {
            return new LiteralExpression(this.next())
        }
        /* todo: add other types of expression
        boolean
        array
        variable + access
        this + access
        null
        json object
        */
       return new InvalidExpression()
    }

}