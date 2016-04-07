/**
 * Created by Cristian-Alexandru Staicu on 04.04.16.
 */
var assert = require("assert");
var sanitizer = require("eval-sanitizer");
//var sanitizer = require("../lib/sanitizer");
var shim = sanitizer.sanitizShim;

/* Valid inputs */
var marker = 0;
eval(sanitizer`for (i = 0; i < 23; i++) i++;; marker = 1;`)
assert (marker === 1);

/* Basic injection */
sanitizer.setPolicy(sanitizer.ONLY_LITERALS);
input = "23; \n marker = 12";
marker = 0;
eval(sanitizer`var x = ${input}`);
assert(marker === 0, "Sanitization failed");

/* Shim test */
marker = 0;
eval(shim("var useless = 23;\n var x = ${input}", { input : input}));
assert(marker === 0, "Sanitization failed");

/* Allow property name policy */
input = "x";
sanitizer.setPolicy(sanitizer.ONLY_LITERALS_AND_IDENTIFIERS);
var colors={setTheme:function(x){assert(x.x === 23);}}
eval(sanitizer`colors.setTheme({${input} : ${input}});`);

/* JSON parsing */
var json = {"menu": {
"header": "SVG Viewer",
    "items": [
    {"id": "Open"},
    {"id": "OpenNew", "label": "Open New"},
    null,
    {"id": "ZoomIn", "label": "Zoom In"},
    {"id": "ZoomOut", "label": "Zoom Out"},
    {"id": "OriginalView", "label": "Original View"},
    null,
    {"id": "Quality"},
    {"id": "Pause"},
    {"id": "Mute"},
    null,
    {"id": "Find", "label": "Find..."},
    {"id": "FindAgain", "label": "Find Again"},
    {"id": "Copy"},
    {"id": "CopyAgain", "label": "Copy Again"},
    {"id": "CopySVG", "label": "Copy SVG"},
    {"id": "ViewSVG", "label": "View SVG"},
    {"id": "ViewSource", "label": "View Source"},
    {"id": "SaveAs", "label": "Save As"},
    null,
    {"id": "Help"},
    {"id": "About", "label": "About Adobe CVG Viewer..."}
]
}};
var jsonStr = JSON.stringify(json);
sanitizer.setPolicy(sanitizer.ONLY_JSON);
eval(sanitizer`var j1 = ${jsonStr}`);
assert(JSON.stringify(j1) === JSON.stringify(json));

var marker = 0;
jsonStr = jsonStr + ";\n marker = 1;"
eval(sanitizer`var j1 = ${jsonStr};`);
assert(JSON.stringify(j1) === JSON.stringify(json));

assert(marker === 0);
eval(`var j1 = ${jsonStr};`);
assert(marker === 1);

jsonStr.replace('"Open"', "marker = 1");
marker = 0;
eval(`var j1 = ${jsonStr};`);
assert(marker === 1);
marker = 0;
eval(sanitizer`var j1 = ${jsonStr};`);
assert(marker === 0);

function f() {
    marker = 1;
}

jsonStr = JSON.stringify(json).replace('"Open"', "f()");
marker = 0;
eval(`var j1 = ${jsonStr};`);
assert(marker === 1);
marker = 0;
eval(sanitizer`var j1 = ${jsonStr};`);
assert(marker === 0);

/* no functions policy */
sanitizer.setPolicy(sanitizer.NO_FUNCTION_CALLS);
marker = 0;
eval(sanitizer`var j1 = ${jsonStr};`);
assert(marker === 0);
jsonStr = jsonStr.replace("f()", "marker = 1");

marker = 0;
eval(sanitizer`var j1 = ${jsonStr};`);
assert(marker === 1);

/* line / row logic */
assert(sanitizer.getNumberLines("test") === 1);
assert(sanitizer.getCharIndex("test") === 4);
assert(sanitizer.getNumberLines("test\nhow\rmany\n\n\nrows") === 6);
assert(sanitizer.getCharIndex("test\nhow\rmany\nrowsx") === 5);
assert(sanitizer.getCharIndex("test\nhow\rmany\n") === 0);