import { ElseStatement, ArrayExpression, AssignableExpression, Assignment, BinaryExpression, CallAccess, CallStatement, CodeBlock, Expression, FieldAccess, IfStatement, InvalidExpression, LiteralExpression, MainBlock, RootNode, Statement, UnaryExpression, VarDeclaration, VariableAccess, ModifierList, ParameterNode, SimpleFunction, ReturnStatement, ExpressionList, StringExpression } from "./ast";
import { BasicTypeToken, FunctionTypeToken, SingleTypeToken, TypeToken } from "./oop";
import { AssignmentOperator, BinaryOperator } from "./operators";
import { DelegateTokenizer, ExpressionSegment, LiteralSegment, Position, StringToken, TextRange, Token, Tokenizer, TokenType } from "./tokenizer";

export class Parser {

    lookforward: Token[] = []
    lastToken: Token
    hasErrors = false

    constructor(public file: string, public tokenizer: Tokenizer) {
        this.lastToken = Token.EOF;
    }

    error(token: Token, msg: string) {
        this.errorRange(token.range, msg + ', found ' + token.value)
    }

    errorRange(range: TextRange, msg: string) {
        console.trace('Compilation error at ' + TextRange.toString(range) + ': ' + msg)
        this.hasErrors = true
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
        return this.lookforward[count] || Token.EOF
    }

    goBack() {
        if (this.lastToken.isValid()) {
            this.lookforward.unshift(this.lastToken)
        }
    }
    
    startRange(): RangeBuilder {
        return new RangeBuilder(this)
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
        this.error(this.peek(), "Expected " + name)
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
            let kw = this.peek()
            switch (kw.value) {
                case 'var':
                    modifiers.assertEmpty(this)
                    return this.parseVarDecl()
                case 'main':
                    modifiers.assertEmpty(this)
                    this.next()
                    let block = this.parseBlock()
                    if (block) {
                        return new MainBlock(kw.range,block.statements)
                    }
                    break
                case 'private':
                case 'native':
                case 'abstract':
                    modifiers.add(this,kw)
                    this.next()
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
        } else if (this.isValueNext('return')) {
            let label = this.next()
            let expr: Expression | undefined= this.parseExpression()
            if (expr instanceof InvalidExpression) {
                expr = undefined
            }
            return new ReturnStatement(label.range, expr)
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
                } else {
                    this.goBack()
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
        if (this.isNext(TokenType.identifier)) {
            let retType: TypeToken = TypeToken.void
            
            if (this.peek(1).value != '(') {
                retType = this.parseTypeToken(true) || TypeToken.void
            }
            let name = this.expect(TokenType.identifier)
            if (name && this.isValueNext('(')) {
                let params = this.parseParameterList()
                let code = this.parseBlock()
                return new SimpleFunction(label.range, modifiers, name, retType, params, code)
            }
        }
    }
    
    parseParameterList() {
        let params: ParameterNode[] = []
        if (this.expectValue('(')) {
            while (this.hasNext() && !this.isValueNext(')')) {
                let p = this.parseParameter();
                if (p) {
                    params.push(p)
                }
                if (!this.isValueNext(',')) {
                    break
                }
            }
            this.expectValue(')')
        }
        return params
    }

    parseParameter(): ParameterNode | undefined {
        let type = this.parseTypeToken(true)
        if (type) {
            let name = this.expect(TokenType.identifier)
            if (name) {
                let vararg = this.skipValue('...')

                let expr: Expression | undefined
                if (!vararg && this.skipValue('=')) {
                    expr = this.parseExpression()
                }
                return new ParameterNode(name, type, expr, vararg)
            }
        }
    }

    parseTypeToken(allowOptional: boolean): TypeToken | undefined {
        let first = this.parseSingleTypeToken(allowOptional)
        if (first) {
            let options: SingleTypeToken[] = [first]
            if (this.isValueNext('|')) {
                while (this.hasNext() && this.skipValue('|')) {
                    let t = this.parseSingleTypeToken(allowOptional)
                    if (t) {
                        options.push(t)
                    } else {
                        break
                    }
                }
            }
            return new TypeToken(options)
        }
    }

    parseSingleTypeToken(allowOptional: boolean): SingleTypeToken | undefined {
        let range = this.startRange()
        if (this.isValueNext('(')) {
            let params = this.parseParameterList()
            let optional = allowOptional && this.skipValue('?')
            this.expectValue('=>')
            let ret = this.parseTypeToken(allowOptional)
            if (ret) {
                return new FunctionTypeToken(range.end(), params, ret, optional)
            }
        } else {
            let base = this.expect(TokenType.identifier)
            if (base) {
                let params: TypeToken[] = []
                if (this.skipValue('<')) {
                    while (this.hasNext() && !this.isValueNext('>')) {
                        let t = this.parseTypeToken(false)
                        if (t) {
                            params.push(t)
                        }
                        if (!this.skipValue(',')) {
                            break
                        }
                    }
                    this.expectValue('>')
                }
                let optional = allowOptional && this.skipValue('?')
                return new BasicTypeToken(range.end(), base, params, optional)
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

    parseExpressionList(end: string): ExpressionList {
        let range = this.startRange()
        let list: Expression[] = []
        while (this.hasNext() && !this.isValueNext(end)) {
            list.push(this.parseExpression())
            if (!this.skipValue(',')) {
                break
            }
        }
        this.expectValue(end)
        return new ExpressionList(list, range.end())
    }

    parseExpression(): Expression {
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
        if (this.isNext(TokenType.int) || this.isNext(TokenType.float) || this.isValueNext('true','false')) {
            expr = new LiteralExpression(this.next())
        } else if (this.isNext(TokenType.string)) {
            let tok = this.next() as StringToken
            expr = new StringExpression(tok.range,tok.segments.map(s=>{
                if (s instanceof ExpressionSegment) {
                    return new Parser(this.file,new DelegateTokenizer(s.tokens)).parseExpression()
                } else {
                    return new LiteralExpression(Token.dummy('"' + (s as LiteralSegment).value + '"'))
                }
            }))
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

export class RangeBuilder {

    start: Position

    constructor(private parser: Parser) {
        this.start = parser.peek().range.start
    }

    end(): TextRange {
        return {start: this.start, end: this.parser.lastToken.range.end}
    }
}