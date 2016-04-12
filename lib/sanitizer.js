/**
 * Copyright (c) 2016, Cristian-Alexandru Staicu, 
 * University of Darmstadt
 * 
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without 
 * modification, are permitted provided that the following conditions 
 * are met:
 * 
 * 1. Redistributions of source code must retain the above copyright 
 * notice, this list of conditions and the following disclaimer.
 * 
 * 2. Redistributions in binary form must reproduce the above copyright 
 * notice, this list of conditions and the following disclaimer in the 
 * documentation and/or other materials provided with the distribution.
 * 
 * 3. Neither the name of the copyright holder nor the names of its 
 * contributors may be used to endorse or promote products derived from 
 * this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT 
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS 
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE 
 * COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, 
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, 
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; 
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER 
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT 
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN 
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE 
 * POSSIBILITY OF SUCH DAMAGE.
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
    var currentCol = 0;
    var currentLine = 1;
    var updateVarAndCol = function(toAdd) {
        var nolines = getNumberLines(toAdd);
        currentLine += nolines - 1;
        if (nolines > 1)
            currentCol = getCharIndex(toAdd);
        else
            currentCol += getCharIndex(toAdd);
    }
    for (var i = 0; i < cts.length; i++) {
        finalString += cts[i];
        updateVarAndCol(cts[i])
        templateString += cts[i];
        if (i < cts.length - 1) {
            var toAdd = arguments[i + 1].toString();
            var startLine = currentLine;
            var startCol = currentCol;
            updateVarAndCol(toAdd);
            userInput.push({startLine : startLine, startCol : startCol, endLine : currentLine, endCol : currentCol});
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

                if (contained(userInput[i].startLine, userInput[i].startCol,
                        userInput[i].endLine, userInput[i].endCol,
                        node.loc.start.line, node.loc.start.column,
                        node.loc.end.line, node.loc.end.column)) { // if the node is fully inside userInput
                    node.label = USER_LABEL;
                    done = true;
                }
            }
            if (done === false)
                node.label = CT_LABEL;
        }
    });
    ast = removeMalicious(ast, origAst);
    try {
        return escodegen.generate(ast);
    }  catch (e) {
        return "";
    }
}

/**
 * Check if 2 dimensional interval B is included in interval A.
 */
function contained(startLineA, startColA, endLineA, endColA, startLineB, startColB, endLineB, endColB) {
    if (startLineB < startLineA)
        return false;
    if (endLineB > endLineA)
        return false;
    if (startLineB === startLineA) {
        if (startColB < startColA)
            return false;
        if (endColB > endColA)
            return false;
    }
    return true;
}

function getNumberLines(str) {
    return str.split(/\r\n|\r|\n/).length;
}

function getCharIndex(str) {
    var lines = str.split(/\r\n|\r|\n/);
    return lines[lines.length - 1].length;
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

module.exports.getNumberLines = getNumberLines;
module.exports.getCharIndex = getCharIndex;

function isInt(n) {
    return n % 1 === 0;
}

function sanitizShim(template, context) {
    var compile = require('es6-template-strings/compile')
    var compiled = compile(template);
    var resolve = require('es6-template-strings/resolve');
    return sanitize.apply(null, resolve(compiled, context));
}
