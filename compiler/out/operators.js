"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignmentOperator = exports.UnaryOperator = exports.BinaryOperator = void 0;
var BinaryOperator;
(function (BinaryOperator) {
    BinaryOperator["plus"] = "+";
    BinaryOperator["minus"] = "-";
    BinaryOperator["mul"] = "*";
    BinaryOperator["div"] = "/";
    BinaryOperator["mod"] = "%";
    BinaryOperator["pow"] = "**";
    BinaryOperator["int_div"] = "//";
    BinaryOperator["lt"] = "<";
    BinaryOperator["gt"] = ">";
    BinaryOperator["le"] = "<=";
    BinaryOperator["ge"] = ">=";
    BinaryOperator["equals"] = "==";
    BinaryOperator["ne"] = "!=";
    BinaryOperator["is"] = "is";
    BinaryOperator["in"] = "in";
    BinaryOperator["as"] = "as";
    BinaryOperator["range"] = "..";
    BinaryOperator["and"] = "&&";
    BinaryOperator["or"] = "||";
})(BinaryOperator = exports.BinaryOperator || (exports.BinaryOperator = {}));
var UnaryOperator;
(function (UnaryOperator) {
    UnaryOperator["plus"] = "+";
    UnaryOperator["minus"] = "-";
    UnaryOperator["not"] = "!";
    UnaryOperator["range"] = "..";
})(UnaryOperator = exports.UnaryOperator || (exports.UnaryOperator = {}));
var AssignmentOperator;
(function (AssignmentOperator) {
    AssignmentOperator["set"] = "=";
    AssignmentOperator["add"] = "+=";
    AssignmentOperator["sub"] = "-=";
    AssignmentOperator["mul"] = "*=";
    AssignmentOperator["div"] = "/=";
    AssignmentOperator["mod"] = "%=";
    AssignmentOperator["int_div"] = "//=";
    AssignmentOperator["pow"] = "**=";
})(AssignmentOperator = exports.AssignmentOperator || (exports.AssignmentOperator = {}));
