/**
 * Created by Cristian-Alexandru Staicu on 16.03.16.
 */
var esprima = require("esprima");
var escodegen = require("escodegen");
var traverse = require("ast-traverse");

const USER_LABEL = 0;
const CT_LABEL = 1;

const ONLY_LITERALS = 0;
const SAME_AST = 1;
const SAME_AST_AND_ONLY_LITERALS = 2;
const ONLY_LITERALS_AND_IDENTIFIERS = 3;
const ONLY_JSON = 4;
const NO_FUNCTION_CALLS = 5;


var currentPolicy = SAME_AST_AND_ONLY_LITERALS;

const HOLE = "HOLE";

function sanitize(cts) {

    var userInput = [];
    var finalString = "";
    var templateString = ""
    for (var i = 0; i < cts.length; i++) {
        finalString += cts[i];
        templateString += cts[i];
        if (i < cts.length - 1) {
            var toAdd = arguments[i + 1].toString();
            userInput.push({ start:finalString.length, end: (finalString.length + toAdd.length)});
            finalString += toAdd;
            templateString += HOLE;
        }
    }
    try {
        var origAst = esprima.parse(templateString, {loc: true});
        var ast = esprima.parse(finalString, {loc: true});
    } catch (e) {
        return finalString;
    }

    traverse(ast, {
        pre: function(node) {
            var done = false;
            for (var i = 0; i < userInput.length; i++) {
                //TODO more sophisticated analysis that considers both row and columns
                if (userInput[i].start <= node.loc.start.column &&  userInput[i].end >= node.loc.end.column) { // if intersection
                    node.label = USER_LABEL;
                    done = true;
                }
            }
            if (done === false)
                node.label = CT_LABEL;
        }
    });
    ast = removeMalicious(ast, origAst)
    try {
        return escodegen.generate(ast);
    }  catch (e) {
        return "";
    }
}

function removeMalicious(runtimeAst, templateAst) {
    var toRemove = [];
    if (currentPolicy === SAME_AST || currentPolicy == SAME_AST_AND_ONLY_LITERALS) {
        removeNewNodes(runtimeAst, templateAst)
        function removeNewNodes(object, templateObject) {
            var key, child;
            for (key in object) {
                if (key != "loc" && object.hasOwnProperty(key)) {
                    child = object[key];

                    if (typeof child === 'object' && child !== null) {
                        if (templateObject[key] && templateObject[key].name === HOLE) {
                            //skipp
                        } else if (templateObject && templateObject[key] && (templateObject[key].type === child.type || typeof  child === typeof templateObject[key])) {
                            removeNewNodes(child, templateObject[key]);
                        } else {
                            if (isInt(key))
                                object.splice(key, 1);
                            else
                                delete object[key];
                        }
                    }
                }
            }
        }
    }
    if (currentPolicy === ONLY_LITERALS || currentPolicy == SAME_AST_AND_ONLY_LITERALS) {
        traverse(runtimeAst, {
            pre: function(node) {

                if (node.label === USER_LABEL && node.type != "Literal") {
                    toRemove.push(node);
                }
            }
        });
    }
    if (currentPolicy === ONLY_LITERALS_AND_IDENTIFIERS) {
        traverse(runtimeAst, {
            pre: function(node) {

                if (node.label === USER_LABEL && node.type != "Literal" && node.type != "Identifier") {
                    toRemove.push(node);
                }
            }
        });
    }
    if (currentPolicy === ONLY_JSON) {
        var types = [];
        traverse(runtimeAst, {
            pre: function(node) {
                if (node.label === USER_LABEL && node.type != "ObjectExpression" && node.type != "Property" && node.type != "Literal" && node.type != "ArrayExpression") {
                    toRemove.push(node);
                }
            }
        });
    }
    if (currentPolicy === NO_FUNCTION_CALLS) {
        var types = [];
        traverse(runtimeAst, {
            pre: function(node) {
                if (node.label === USER_LABEL && node.type === "CallExpression") {
                    toRemove.push(node);
                }
            }
        });
    }
    trav(runtimeAst, null, null, null);

    function trav(object, parent) {
        var key, child;
        for (key in object) {
            if (object.hasOwnProperty(key)) {
                child = object[key];
                if (typeof child === 'object' && child !== null) {
                    if (toRemove.indexOf(child) === -1)
                        trav(child, object);
                    else {
                        if (isInt(key))
                            object.splice(key, 1);
                        else
                            delete object[key];
                    }
                }
            }
        }
    }
    return runtimeAst;
}

module.exports = sanitize;
module.exports.sanitizShim = sanitizShim;

module.exports.ONLY_LITERALS =  ONLY_LITERALS;
module.exports.SAME_AST =  SAME_AST;
module.exports.SAME_AST_AND_ONLY_LITERALS =  SAME_AST_AND_ONLY_LITERALS;
module.exports.ONLY_LITERALS_AND_IDENTIFIERS = ONLY_LITERALS_AND_IDENTIFIERS;
module.exports.ONLY_JSON =  ONLY_JSON;
module.exports.NO_FUNCTION_CALLS =  NO_FUNCTION_CALLS;

module.exports.setPolicy = function(policy) {
    if (policy)
        currentPolicy = policy;
    return sanitize;
}

function isInt(n) {
    return n % 1 === 0;
}

function sanitizShim(template, context) {
    var compile = require('es6-template-strings/compile')
    var compiled = compile(template);
    var resolve = require('es6-template-strings/resolve');
    return sanitize.apply(null, resolve(compiled, context));
}