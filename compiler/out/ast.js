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
exports.CallAccess = exports.VariableRootAccess = exports.FieldAccess = exports.AssignableAccessNode = exports.AccessNode = exports.AssignableExpression = exports.Assignment = exports.UnaryExpression = exports.BinaryExpression = exports.Expression = exports.ElseStatement = exports.IfStatement = exports.VarDeclaration = exports.MainBlock = exports.CodeBlock = exports.Statement = exports.RootNode = exports.ASTNode = void 0;
var ASTNode = /** @class */ (function () {
    function ASTNode(id) {
        this.id = id;
    }
    return ASTNode;
}());
exports.ASTNode = ASTNode;
var RootNode = /** @class */ (function (_super) {
    __extends(RootNode, _super);
    function RootNode() {
        var _this = _super.call(this, "root") || this;
        _this.statements = [];
        return _this;
    }
    return RootNode;
}(ASTNode));
exports.RootNode = RootNode;
var Statement = /** @class */ (function (_super) {
    __extends(Statement, _super);
    function Statement(id, label) {
        var _this = _super.call(this, id) || this;
        _this.label = label;
        return _this;
    }
    return Statement;
}(ASTNode));
exports.Statement = Statement;
var CodeBlock = /** @class */ (function (_super) {
    __extends(CodeBlock, _super);
    function CodeBlock() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return CodeBlock;
}(Statement));
exports.CodeBlock = CodeBlock;
var MainBlock = /** @class */ (function (_super) {
    __extends(MainBlock, _super);
    function MainBlock(label) {
        return _super.call(this, "main", label) || this;
    }
    return MainBlock;
}(CodeBlock));
exports.MainBlock = MainBlock;
var VarDeclaration = /** @class */ (function (_super) {
    __extends(VarDeclaration, _super);
    function VarDeclaration(label, name, init) {
        var _this = _super.call(this, "var_declaration", label) || this;
        _this.name = name;
        _this.init = init;
        return _this;
    }
    return VarDeclaration;
}(Statement));
exports.VarDeclaration = VarDeclaration;
var IfStatement = /** @class */ (function (_super) {
    __extends(IfStatement, _super);
    function IfStatement(label, expr, then, orElse) {
        var _this = _super.call(this, "if", label) || this;
        _this.expr = expr;
        _this.then = then;
        _this.orElse = orElse;
        return _this;
    }
    return IfStatement;
}(Statement));
exports.IfStatement = IfStatement;
var ElseStatement = /** @class */ (function (_super) {
    __extends(ElseStatement, _super);
    function ElseStatement(label, code) {
        var _this = _super.call(this, "else", label) || this;
        _this.code = code;
        return _this;
    }
    return ElseStatement;
}(Statement));
exports.ElseStatement = ElseStatement;
var Expression = /** @class */ (function (_super) {
    __extends(Expression, _super);
    function Expression() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return Expression;
}(ASTNode));
exports.Expression = Expression;
var BinaryExpression = /** @class */ (function (_super) {
    __extends(BinaryExpression, _super);
    function BinaryExpression(left, op, right) {
        var _this = _super.call(this, "binary_expression") || this;
        _this.left = left;
        _this.op = op;
        _this.right = right;
        return _this;
    }
    return BinaryExpression;
}(Expression));
exports.BinaryExpression = BinaryExpression;
var UnaryExpression = /** @class */ (function (_super) {
    __extends(UnaryExpression, _super);
    function UnaryExpression(op, expr) {
        var _this = _super.call(this, "unary_expression") || this;
        _this.op = op;
        _this.expr = expr;
        return _this;
    }
    return UnaryExpression;
}(Expression));
exports.UnaryExpression = UnaryExpression;
var Assignment = /** @class */ (function (_super) {
    __extends(Assignment, _super);
    function Assignment(variable, opRange, op, expression) {
        var _this = _super.call(this, "assignment", opRange) || this;
        _this.variable = variable;
        _this.op = op;
        _this.expression = expression;
        return _this;
    }
    return Assignment;
}(Statement));
exports.Assignment = Assignment;
var AssignableExpression = /** @class */ (function (_super) {
    __extends(AssignableExpression, _super);
    function AssignableExpression(assignable, chain) {
        var _this = _super.call(this, "assignable_expression") || this;
        _this.assignable = assignable;
        _this.chain = chain;
        return _this;
    }
    return AssignableExpression;
}(ASTNode));
exports.AssignableExpression = AssignableExpression;
var AccessNode = /** @class */ (function (_super) {
    __extends(AccessNode, _super);
    function AccessNode(name, parent) {
        var _this = _super.call(this, name) || this;
        _this.parent = parent;
        return _this;
    }
    return AccessNode;
}(ASTNode));
exports.AccessNode = AccessNode;
var AssignableAccessNode = /** @class */ (function (_super) {
    __extends(AssignableAccessNode, _super);
    function AssignableAccessNode() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return AssignableAccessNode;
}(AccessNode));
exports.AssignableAccessNode = AssignableAccessNode;
var FieldAccess = /** @class */ (function (_super) {
    __extends(FieldAccess, _super);
    function FieldAccess(field, parent) {
        var _this = _super.call(this, "field_access", parent) || this;
        _this.field = field;
        return _this;
    }
    return FieldAccess;
}(AssignableAccessNode));
exports.FieldAccess = FieldAccess;
var VariableRootAccess = /** @class */ (function (_super) {
    __extends(VariableRootAccess, _super);
    function VariableRootAccess(name) {
        var _this = _super.call(this, "variable_access") || this;
        _this.name = name;
        return _this;
    }
    return VariableRootAccess;
}(AssignableAccessNode));
exports.VariableRootAccess = VariableRootAccess;
var CallAccess = /** @class */ (function (_super) {
    __extends(CallAccess, _super);
    function CallAccess(params, parent) {
        var _this = _super.call(this, "call_access", parent) || this;
        _this.params = params;
        return _this;
    }
    return CallAccess;
}(AccessNode));
exports.CallAccess = CallAccess;
