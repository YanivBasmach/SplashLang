import { ElseStatement, ArrayExpression, AssignableExpression, Assignment, BinaryExpression, CallAccess, CallStatement, CodeBlock, Expression, FieldAccess, IfStatement, InvalidExpression, LiteralExpression, MainBlock, RootNode, Statement, UnaryExpression, VarDeclaration, VariableAccess, ModifierList } from "./ast";
import { AssignmentOperator, BinaryOperator } from "./operators";
import { TextRange, Token, Tokenizer, TokenType } from "./tokenizer";

export class Parser {

    lookforward: Token[] = []
    lastToken: Token

    constructor(public file: string, public tokenizer: Tokenizer) {
        this.lastToken = Token.EOF;
    }

    error(token: Token, msg: string) {
        this.errorRange(token.range, msg)
    }

    errorRange(range: TextRange, msg: string) {
        console.log('Compilation error at ' + TextRange.toString(range) + ': ' + msg)
    }

    next(skipComments = true): Token {
        if (this.lookforward.length > 0) {
            let n = this.lookforward.shift();
            this.lastToken = n || Token.EOF
            return n || Token.EOF
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

    skipEmptyLines() {
        while (this.hasNext() && this.isNext(TokenType.line_end)) {
            this.next()
        }
    }

    parseFile(): RootNode {
        let root = new RootNode()

        while (this.hasNext()) {
            if (this.isNext(TokenType.line_end)) {
                this.next()
            } else {
                let s = this.parseTopLevel(new ModifierList())
                if (s) {
                    root.statements.push(s)
                    if (this.hasNext()) {
                        this.expect(TokenType.line_end)
                    }
                } else {
                    while (this.hasNext() && !this.isNext(TokenType.line_end)) {
                        this.next()
                    }
                }
            }
        }

        return root
    }

    parseTopLevel(modifiers: ModifierList): Statement | undefined {
        if (this.isNext(TokenType.keyword)) {
            let kw = this.next()
            switch (kw.value) {
                case 'var':
                    modifiers.assertEmpty(this)
                    return this.parseVarDecl()
                case 'main':
                    modifiers.assertEmpty(this)
                    let block = this.parseBlock()
                    if (block) {
                        return new MainBlock(kw.range,block.statements)
                    }
                    break
                case 'private':
                case 'native':
                case 'abstract':
                    modifiers.add(this,kw)
                    return this.parseTopLevel(modifiers)
                case 'function':
                    return this.parseFunction(modifiers)
            }
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
                    if (this.hasNext()) {
                        this.expect(TokenType.line_end)
                    }
                } else {
                    while (this.hasNext() && !this.isNext(TokenType.line_end)) {
                        this.next()
                    }
                }
            }

            this.expectValue('}')
            return block
        }
        return undefined
    }

    parseStatement(): Statement | undefined {
        if (this.isValueNext('var')) {
            return this.parseVarDecl()
        } else if (this.isValueNext('if')) {
            return this.parseIf()
        } else if (this.isValueNext('{')) {
            return this.parseBlock()
        } else {
            return this.parseVarAccess()
        }
    }

    parseIf(): IfStatement | undefined {
        let label = this.next()
        if (this.expectValue('(')) {
            let expr = this.parseExpression()
            this.expectValue(')')
            this.skipEmptyLines()
            let then = this.parseStatement()
            if (then) {
                let orElse: ElseStatement | undefined
                this.skipEmptyLines()
                if (this.isValueNext('else')) {
                    let l = this.next()
                    this.skipEmptyLines()
                    let statement = this.parseStatement()
                    if (statement) {
                        orElse = new ElseStatement(l.range, statement)
                    } else {
                        this.error(this.peek(),"Expected else statement")
                    }
                }
                return new IfStatement(label.range, expr, then, orElse)
            } else {
                this.error(this.peek(),"Expected if statement")
            }
        }
    }

    parseFunction(modifiers: ModifierList): Statement | undefined {
        modifiers.assertHasOnly(this,'private','native')
        let label = this.next()
        let name = this.expect(TokenType.identifier)
        if (name) {
            if (this.isValueNext('(')) {
                let params = this.parseParameterList()
                
            }
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
        let v = this.parsePrimaryExpression()
        if (v instanceof AssignableExpression) {
            let assignOp = this.expectOneOf('assignment operator',...Object.values(AssignmentOperator))
            let value = this.parseExpression()
            return new Assignment(v, assignOp, value)
        } else if (v instanceof CallAccess) {
            return new CallStatement(v, this.lastToken.range || TextRange.end)
        } else if (v instanceof InvalidExpression) {
            return
        }
        this.error(this.peek(),'Cannot assign to this expression')
    }

    parseAccessChain(parent: Expression): Expression {
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
            if (!this.skipValue(',')) {
                break
            }
        }
        this.expectValue(end)
        return list
    }

    parseExpression(): Expression {
        console.log('parsing expression')
        let expr = this.parseOrExpression()
        while (this.isValueNext('&&')) {
            expr = new BinaryExpression(expr,this.next(),this.parseOrExpression());
        }
        return expr
    }

    parseOrExpression(): Expression {
        let expr = this.parseEqualityExpression()
        while (this.isValueNext('||')) {
            expr = new BinaryExpression(expr,this.next(),this.parseEqualityExpression());
        }
        return expr
    }

    parseEqualityExpression(): Expression {
        let expr = this.parseComparisonExpression()
        while (this.isValueNext('==','!=')) {
            expr = new BinaryExpression(expr,this.next(),this.parseComparisonExpression());
        }
        return expr
    }

    parseComparisonExpression(): Expression {
        let expr = this.parseAdditiveExpression()
        while (this.isValueNext('<','>','<=','>=','is')) {
            expr = new BinaryExpression(expr,this.next(),this.parseAdditiveExpression());
        }
        return expr
    }

    parseAdditiveExpression(): Expression {
        let expr = this.parseMultiExpression()
        while (this.isValueNext('+','-')) {
            expr = new BinaryExpression(expr,this.next(),this.parseMultiExpression());
        }
        return expr
    }

    parseMultiExpression(): Expression {
        let expr = this.parsePowExpression()
        while (this.isValueNext('*','/','//','%')) {
            expr = new BinaryExpression(expr,this.next(),this.parsePowExpression());
        }
        return expr
    }

    parsePowExpression(): Expression {
        let expr = this.parseIsInExpression()
        while (this.isValueNext('**')) {
            expr = new BinaryExpression(expr,this.next(),this.parseIsInExpression());
        }
        return expr
    }

    parseIsInExpression(): Expression {
        let expr = this.parseUnaryExpression()
        while (this.isValueNext('as','in')) {
            expr = new BinaryExpression(expr,this.next(),this.parseUnaryExpression());
        }
        return expr
    }

    parseUnaryExpression(): Expression {
        if (this.isValueNext('+','-','!','..')) {
            return new UnaryExpression(this.next(),this.parsePrimaryExpression());
        }
        return this.parsePrimaryExpression()
    }

    parsePrimaryExpression(): Expression {
        let expr: Expression
        if (this.isNext(TokenType.int) || this.isNext(TokenType.string) || this.isNext(TokenType.float) || this.isValueNext('true','false')) {
            expr = new LiteralExpression(this.next())
        } else if (this.isNext(TokenType.identifier)) {
            expr = new VariableAccess(this.next())
        } else if (this.skipValue('[')) {
            let values = this.parseExpressionList(']')
            expr = new ArrayExpression(values)
        } else if (this.skipValue('(')) {
            expr = this.parseExpression()
            this.expectValue(')')
        } else {
            return new InvalidExpression()
        }
        return this.parseAccessChain(expr)
        /* todo: add other types of expression
        this + access
        null
        json object
        */
    }

}