Parsing-based sanitization package for eval.

## eval-sanitizer
Everybody is aware of the dangers of using **eval**, especially when user input is involved. Nevertheless, eval is still
prevalent in the npm community. This package aims at solving this problem by
sanitizing the string passed to eval.

## Usage
```js
var userInput = "23; console.log('Injection Succeded')";

var sanitiz = require("eval-sanitizer");
var safeStr = sanitiz`var x = ${userInput}`; // removes console.log call
eval(safeStr);                               // safe to pass to eval
```

## Requirements
This package requires ECMAScript 6 quasi-literals to mark user input in the string to be sanitized. It removes all the
parts of the user input that may be harmful by enforcing one of the available policies. The dynamic part of the
quasi-literal is assumed to be the user input.

## Policies
A policy defines constraints on the nature of the user input. Currently there are three available policies:
* **ONLY_LITERALS**: enforces that the user input contains only literals.
* **ONLY_LITERALS_AND_IDENTIFIERS**: enforces that the user input contains only literals and identifiers.
* **SAME_AST**: enforces that the static [AST](https://en.wikipedia.org/wiki/Abstract_syntax_tree) and the dynamic one match, allowing for the user input to contain also non-literals.
* **SAME_AST_AND_ONLY_LITERALS**: the default policy, enforces that the static [AST](https://en.wikipedia.org/wiki/Abstract_syntax_tree) and the dynamic one are the same and.
* **ONLY_JSON**: only object literals with literal properties or arrays with literals are allowed.
* **NO_FUNCTION_CALLS**: no function calls are allowed in user input.
that the user entered only literals.

Example of how the used policy may be modified:
```js
var sanitizer = require("eval-sanitizer");
sanitizer.setPolicy(sanitizer.ONLY_LITERALS);

```
