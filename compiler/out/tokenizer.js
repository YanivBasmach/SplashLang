"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tokenizer = exports.TokenType = exports.ExpressionSegment = exports.LiteralSegment = exports.StringToken = exports.Token = exports.TextRange = void 0;
var TextRange;
(function (TextRange) {
    function atLine(line, start, end) {
        return { start: { line: line, column: start }, end: { line: line, column: end } };
    }
    TextRange.atLine = atLine;
    function toString(range) {
        if (isInOneLine(range)) {
            return range.start.line + ", " + range.start.column + "-" + range.end.column;
        }
        return range.start.line + ":" + range.start.column + "-" + range.end.line + ":" + range.end.column;
    }
    TextRange.toString = toString;
    function isInOneLine(range) {
        return range.start.line == range.end.line;
    }
    TextRange.isInOneLine = isInOneLine;
    function oneChar(pos) {
        return plus(pos, 1);
    }
    TextRange.oneChar = oneChar;
    function plus(pos, count) {
        return { start: pos, end: { line: pos.line, column: pos.column + count } };
    }
    TextRange.plus = plus;
})(TextRange = exports.TextRange || (exports.TextRange = {}));
var Token = /** @class */ (function () {
    function Token(type, value, range) {
        this.type = type;
        this.value = value;
        this.range = range;
    }
    Token.invalid = function (range) {
        return new Token(TokenType.invalid, "", range);
    };
    Token.prototype.isValid = function () {
        return this.type != TokenType.invalid;
    };
    Token.prototype.toString = function () {
        return TokenType[this.type] + ':' + this.value + '(' + TextRange.toString(this.range) + ')';
    };
    return Token;
}());
exports.Token = Token;
var StringToken = /** @class */ (function (_super) {
    __extends(StringToken, _super);
    function StringToken(value, segments, range) {
        var _this = _super.call(this, TokenType.string, value, range) || this;
        _this.segments = segments;
        return _this;
    }
    StringToken.prototype.toString = function () {
        return 'string:' + this.segments.join('') + '(' + TextRange.toString(this.range) + ')';
    };
    return StringToken;
}(Token));
exports.StringToken = StringToken;
var LiteralSegment = /** @class */ (function () {
    function LiteralSegment() {
        this.value = "";
    }
    LiteralSegment.prototype.toString = function () {
        return this.value;
    };
    return LiteralSegment;
}());
exports.LiteralSegment = LiteralSegment;
var ExpressionSegment = /** @class */ (function () {
    function ExpressionSegment() {
        this.tokens = [];
    }
    ExpressionSegment.prototype.toString = function () {
        return '{' + this.tokens + '}';
    };
    return ExpressionSegment;
}());
exports.ExpressionSegment = ExpressionSegment;
var TokenType;
(function (TokenType) {
    TokenType[TokenType["keyword"] = 0] = "keyword";
    TokenType[TokenType["identifier"] = 1] = "identifier";
    TokenType[TokenType["symbol"] = 2] = "symbol";
    TokenType[TokenType["int"] = 3] = "int";
    TokenType[TokenType["float"] = 4] = "float";
    TokenType[TokenType["string"] = 5] = "string";
    TokenType[TokenType["line_end"] = 6] = "line_end";
    TokenType[TokenType["comment"] = 7] = "comment";
    TokenType[TokenType["invalid"] = 8] = "invalid";
})(TokenType = exports.TokenType || (exports.TokenType = {}));
var symbols = ['~', '`', ';', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '+', '=', '[', ']', '{', '}', '\'', ':', '"', ',', '?', '/', '|', '\\', '.', '<', '>'];
var multiCharOperators = ['++', '--', '&&', '||', '**', '//', '<=', '>=', '==', '!=', '..', '+=', '-=', '*=', '/=', '%=', '**=', '//='];
var keywords = ['main', 'function', 'if', 'var', 'const', 'as', 'is', 'in', 'while', 'for', 'switch', 'return', 'constructor', 'private', 'protected', 'abstract', 'final', 'static', 'readonly', 'operator', 'iterator', 'indexer', 'accessor', 'invoker', 'true', 'false', 'null'];
var Tokenizer = /** @class */ (function () {
    function Tokenizer(input) {
        this.input = input;
        this.pos = 0;
        this.line = 0;
        this.column = 0;
    }
    Tokenizer.prototype.next = function () {
        if (!this.canRead())
            return;
        var start = { line: this.line, column: this.column };
        var c = this.nextChar();
        switch (c) {
            case ' ':
                while (c == ' ') {
                    c = this.nextChar();
                }
                this.pos--;
                this.column--;
                return this.next();
            case '\r':
                return this.next();
            case '\n':
                var t = new Token(TokenType.line_end, '\n', TextRange.oneChar(start));
                this.line++;
                this.column = 0;
                return t;
            case '"':
            case '\'':
                return this.readString(start, c);
            default:
                if (/[0-9]/.test(c)) {
                    return this.readNumber(start, c);
                }
                if (/[a-zA-Z_]/.test(c)) {
                    return this.readIdentifier(start, c);
                }
                if (symbols.includes(c)) {
                    return this.readSymbol(start, c);
                }
                return Token.invalid({ start: start, end: this.getPos() });
        }
    };
    Tokenizer.prototype.canRead = function () {
        return this.pos < this.input.length;
    };
    Tokenizer.prototype.nextChar = function () {
        this.column++;
        return this.input[this.pos++];
    };
    Tokenizer.prototype.getPos = function () {
        return { line: this.line, column: this.column };
    };
    Tokenizer.prototype.readString = function (start, quote) {
        var segments = [];
        var current;
        while (this.canRead()) {
            var c = this.nextChar();
            if (c == '{') {
                current = new ExpressionSegment();
                segments.push(current);
                var tok = this.next();
                var stack = 0;
                while (tok && tok.isValid() && (stack > 0 || tok.value != '}')) {
                    current.tokens.push(tok);
                    if (tok.value == '{')
                        stack++;
                    else if (tok.value == '}')
                        stack--;
                    tok = this.next();
                }
            }
            else if (c == '\n') {
                return Token.invalid({ start: start, end: this.getPos() });
            }
            else if (c != quote) {
                if (!(current instanceof LiteralSegment)) {
                    current = new LiteralSegment();
                    segments.push(current);
                }
                current.value += c;
                if (c == '\\' && this.canRead()) {
                    current.value += this.nextChar();
                }
            }
            else {
                break;
            }
        }
        return new StringToken(segments.join(), segments, { start: start, end: this.getPos() });
    };
    Tokenizer.prototype.readNumber = function (start, first) {
        var str = first;
        while (this.canRead()) {
            var c = this.nextChar();
            if (/[0-9]/.test(c)) {
                str += c;
            }
            else if (c == '.') {
                if (!str.includes('.')) {
                    str += '.';
                }
                else if (str[str.length - 1] == '.') {
                    str = str.substring(0, str.length - 1);
                    this.column -= 2;
                    this.pos -= 2;
                    break;
                }
                else {
                    this.column--;
                    this.pos--;
                    break;
                }
            }
            else {
                this.column--;
                this.pos--;
                break;
            }
        }
        if (str.indexOf('.') < 0) {
            return new Token(TokenType.int, parseInt(str), { start: start, end: this.getPos() });
        }
        else {
            return new Token(TokenType.float, parseFloat(str), { start: start, end: this.getPos() });
        }
    };
    Tokenizer.prototype.readIdentifier = function (start, first) {
        var val = first;
        while (this.canRead()) {
            var c = this.nextChar();
            if (/[a-zA-Z_0-9]/.test(c)) {
                val += c;
            }
            else {
                this.column--;
                this.pos--;
                break;
            }
        }
        if (keywords.includes(val)) {
            return new Token(TokenType.keyword, val, { start: start, end: this.getPos() });
        }
        return new Token(TokenType.identifier, val, { start: start, end: this.getPos() });
    };
    Tokenizer.prototype.readSymbol = function (start, first) {
        var op = first;
        var lastValid = op;
        while (this.canRead()) {
            var c = this.nextChar();
            if (symbols.includes(c)) {
                op += c;
                if (multiCharOperators.includes(op)) {
                    lastValid = op;
                }
            }
            else {
                this.column--;
                this.pos--;
                break;
            }
        }
        this.column -= (op.length - lastValid.length);
        this.pos -= (op.length - lastValid.length);
        return new Token(TokenType.symbol, lastValid, { start: start, end: this.getPos() });
    };
    return Tokenizer;
}());
exports.Tokenizer = Tokenizer;
