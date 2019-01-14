
/*
Copyright 2019 Jonathan Annett
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/*

 Homework Assignment #5

 asynchonrous test scaffolding
 
  - allows full end to end testing of complex functions that happen asynchronously
  - each test is run in the order defined, after the previous test has passed or failed
  - tests that don't call done() after 10 seconds are abandonded as failed
  - tests that call done more than once are ignored, and the repeat call is logged.
  - exceptions that happen out of the scope of the test function are trapped and logged
  - the source code of the test function is printed in the error message for failed tests
  - the best guess at source code file line and number is made by walking the error.stack array in any messages
  - test tesults are saved to a json file, along with a sha256sum of the source file
    files that have not changed since passing all tests are not tested again

*/


"use strict";
/* explode-require the node-libs we need */
var needed =
    "assert,fs,path,crypto";
var [assert,fs,path,crypto] = needed.split(",").map(require);

var _app = module.exports = {};

_app.timeout = 10000;

_app.timeout_log_after = 5000;

_app.timeout_log_every = 1000;

_app.tests    = {};
_app.stats    = {};
_app.setStats = {};
_app.setStatJSON = {};

_app.colors = {
    normal : "\x1b[0m",
    black : "\x1b[30m",
    red : "\x1b[31m",
    green : "\x1b[32m",
    yellow : "\x1b[33m",
    blue : "\x1b[34m",
    magenta : "\x1b[35m",
    cyan : "\x1b[36m",
    white : "\x1b[37m"
};
_app.colors.args  = _app.colors.yellow;
_app.colors.symbol  = _app.colors.yellow;
_app.colors.property  = _app.colors.magenta;
_app.colors.error   = _app.colors.red;
_app.colors.keyword = _app.colors.green;
_app.colors.reserved = _app.colors.cyan;
_app.colors.string = _app.colors.yellow;


var sourceCodeTestNeeded = function(testName,filename) {
    var testStatsFn = path.join(path.dirname(filename),path.basename(filename)+".ver.json"),
    testNeeded = !fs.existsSync(testStatsFn),
    sha256sum = crypto.createHash("sha256").update(fs.readFileSync(filename), "utf8").digest("base64");
    var lastFail=false;
    if (!testNeeded) {
        var selfTestStats = JSON.parse(fs.readFileSync(testStatsFn));
        testNeeded = ( sha256sum !== selfTestStats.sha256sum);
        if (!selfTestStats.results || selfTestStats.results.errors.length>0) {
            lastFail = true;
        }
    }
    
    var dispname = "..."+filename.substr(path.dirname(path.dirname(path.dirname(__filename))).length);
    _app.setStatJSON[testName]={fn:testStatsFn,sha256sum:sha256sum};
    
    if (process.argv.indexOf("--all")>=0 ) {
        console.log(_app.colors.yellow + sha256sum +" testing "+_app.colors.red + dispname+"  ( --all switch ) "+_app.colors.normal);
        testNeeded = true;
    } else {
    
        if (testNeeded) {
            console.log(_app.colors.yellow + sha256sum +" "+_app.colors.red + dispname+" changed since last test"+_app.colors.normal);
        } else {
            console.log(_app.colors.yellow + sha256sum +" "+_app.colors.green +dispname+" unchanged since last test"+_app.colors.normal);
            if (lastFail && testName!=="selfTest") {
                testNeeded = true;
                console.log(_app.colors.yellow + sha256sum +" "+_app.colors.red +dispname+" failed on last test"+_app.colors.normal);
            }
            
        }
    }
    return testNeeded;
},
selfTestNeeded,
runTestsIfNeeded = function (testName,rel_path) {
    if (sourceCodeTestNeeded(testName,path.join(path.dirname(__filename),rel_path+".js"))) {
        _app.tests[testName] =  require(rel_path).tests;
    }
};


var javascript = {
    reserved : "done.assert.abstract.arguments.await.boolean.break.byte.case.catch.char.class.const.continue.debugger.default.delete.do.double.else.enum.eval.export.extends.false.final.finally.float.for.function.goto.if.implements.import.in.instanceof.int.interface.let.long.native.new.null.package.private.protected.public.return.short.static.super.switch.synchronized.this.throw.throws.transient.true.try.typeof.var.void.volatile.while.with.yield".split("."),
    properties : "hasOwnProperty.Infinity.isFinite.isNaN.isPrototypeOf.length.Math.NaN.name.Number.Object.prototype.String.toString.undefined.valueOf".split("."),
};

javascript.colors = {
    reserved : javascript.reserved.map(function(token){ return _app.colors.reserved+token+_app.colors.normal;}),
    properties : javascript.properties.map(function(token){ return _app.colors.property+token+_app.colors.normal;}),
   
};

// a rough and ready javascript colorizer
// does not cope with comments, but does handle strings.
javascript.colorize = function (src){
   var tokens = [];
   
   // tokenize the javascript source
   src.split(" ").forEach(function(token,i){
       if (i>0) tokens.push(' ');
       token.split(".").forEach(function(token,i){
           if (i>0) tokens.push('.');
           token.split(",").forEach(function(token,i){
               if (i>0) tokens.push(',');
               token.split(";").forEach(function(token,i){
                   if (i>0) tokens.push(';');
                   token.split("'").forEach(function(token,i){
                       if (i>0) tokens.push("'");
                       token.split('"').forEach(function(token,i){
                           if (i>0) tokens.push('"');
                           token.split('+').forEach(function(token,i){
                               if (i>0) tokens.push('+');
                               token.split('-').forEach(function(token,i){
                                   if (i>0) tokens.push('-');
                                   token.split('*').forEach(function(token,i){
                                       if (i>0) tokens.push('*');
                                       token.split('/').forEach(function(token,i){
                                           if (i>0) tokens.push('/');
                                           token.split('\\').forEach(function(token,i){
                                               if (i>0) tokens.push('\\');
                                               token.split('\t').forEach(function(token,i){
                                                   if (i>0) tokens.push('\t');
                                                   token.split('\n').forEach(function(token,i){
                                                       if (i>0) tokens.push('\n');
                                                       token.split(':').forEach(function(token,i){
                                                           if (i>0) tokens.push(':');
                                                           token.split('(').forEach(function(token,i){
                                                               if (i>0) tokens.push('(');
                                                               token.split(')').forEach(function(token,i){
                                                                   if (i>0) tokens.push(')');
                                                                   token.split('{').forEach(function(token,i){
                                                                       if (i>0) tokens.push('{');
                                                                       token.split('}').forEach(function(token,i){
                                                                           if (i>0) tokens.push('}');
                                                                           tokens.push (token);
                                                                       });
                                                                   });
                                                               });
                                                           });
                                                       });
                                                   });
                                               });
                                           });
                                       });
                                   });
                               });
                           });
                       });
                   });
               });    
           });
       });
   });
   
   var instr=false,escaped=false;
   // colorize the tokens
   var result = tokens.map(function(token){
       if (instr) {
           
           if (!escaped && instr===token) {
               instr = false;
               return token+ _app.colors.normal;
           }
           
           if (token==="\\") {
                escaped = !escaped;
           } else {
                escaped=false;
           }
           
           return token;
       } else {
            switch (token) {
                   
                   case ";": case ":": case ".": case ",":
                   
                   case "+": case "-": case "/": case "*":
                   case "(": case ")":
                   case "{" : case "}" :
                   case "\\":
                       return _app.colors.symbol + token + _app.colors.normal;
                   case '"': case "'":
                       instr = token;
                       return _app.colors.string + token;
                   
                   default:
                   var ix = javascript.reserved.indexOf(token);
                   if (ix>=0) {
                       return javascript.colors.reserved[ix];
                   }
                   ix = javascript.properties.indexOf(token);
                   if (ix>=0) {
                       return javascript.colors.properties[ix];
                   }
                   return token;
            }
       }
   });
   
   return result.join("");
};


var printReport = function(failLimit,testLimit) {
    var hr = new Array(process.stdout.columns).join("-");
    var testSetNames = Object.keys(_app.tests);
    
    var indentStr = function(str,indent,shiftCount,popCount) {
        shiftCount=shiftCount?shiftCount:0;
        popCount=popCount?popCount:0;
        var lines = str.trim().split("\n");
        if (shiftCount || popCount) {
            
            while (shiftCount-->0) lines.shift();
            while (popCount-->0) lines.pop();
            
            var m = lines.reduce(function(m,line){
                var c=0;
                for (var i=0;i<line.length;i++){
                    if (line.charAt(i)===' ') 
                        c++; 
                    else 
                        break;
                }
                return c > m ? c : m;
            },0);
            
            lines = lines.map(function (line){
                return line.substr(m);
            });
        }
        
        lines.forEach(function(line){console.log(new Array(indent+1).join(" ")+line);});
    };
    
    var collateStats = function (stats) {
       if (stats.started && stats.finished) {
            stats.duration = stats.finished - stats.started;
            delete stats.started;
            delete stats.finished;
            return stats.duration;
        } else {
            stats.duration = false;
            return 0;
        } 
    };
    
    var isNodeJsMap=[ 'assert',
        'buffer',
        'child_process',
        'cluster',
        'crypto',
        'dgram',
        'dns',
        'domain',
        'events',
        'fs',
        'http',
        'https',
        'net',
        'os',
        'path',
        'punycode',
        'querystring',
        'readline',
        'stream',
        'string_decoder',
        'tls',
        'tty',
        'url',
        'util',
        'vm',
        'zlib' ].map(function(mod){return "("+mod+".js:"}),
        isNodeJs= function (line) {
            return isNodeJsMap.some(function(mod){
                return line.indexOf(mod) >= 0;
            });
        };
    
    
    collateStats(_app.stats);
    
    testSetNames.forEach(function(testSetName){
        
        collateStats(_app.setStats[testSetName]);
        
        var testSet = _app.tests[testSetName];
        
        var testNames = Object.keys(testSet);
        testNames.forEach(function(testName){
            collateStats(testSet[testName]);
        });
        
    });
    
    console.log("");
    console.log(hr);
    console.log("   Test Results");
    console.log(hr);
    console.log("");
    console.log("      Tests Run:  "+testLimit );
    console.log("      Fail Limit: "+failLimit );
    console.log("      Passes:     "+_app.stats.passes);
    console.log("      Failures:   "+_app.stats.errors.length);
    console.log("      Run Time:   "+ String(_app.stats.duration /1000) );
    console.log("");
    console.log(hr);
    console.log("");
    console.log("      Breakdown:");
    console.log("");
    testSetNames.forEach(function(testSetName){
        var stats = _app.setStats[testSetName];
        console.log("         "+testSetName+" :  ");
        console.log("          Passes:     "  + ( stats.errors.length === 0 ? _app.colors.green : _app.colors.yellow )  + stats.passes + _app.colors.normal );
        console.log("          Failures:   " + ( stats.errors.length === 0 ? _app.colors.green : _app.colors.red ) + stats.errors.length + _app.colors.normal);
        console.log("          Run Time:   " + String(stats.duration /1000) );
        console.log("");
        
    });
    console.log(hr);
    console.log("");
    if (_app.stats.errors.length) {
          testSetNames.forEach(function(testSetName){
            var stats = _app.setStats[testSetName];
            if (stats.errors.length>0) {
                console.log("         "+testSetName+" :  ");
                stats.errors.forEach(function(failedTestFN){
                    console.log("          Test:       "+_app.colors.yellow+failedTestFN.testName+_app.colors.normal);
                    console.log("          Error:"+_app.colors.red);
                    indentStr(String(failedTestFN.exception),22);
                    var line="?",lines = failedTestFN.exception.stack.split("\n");
                    while (lines && line && line.trim().substr(0,3)!=="at " ) {
                        line = lines.shift();
                    }
                    
                    while (lines && line && line.trim().substr(0,3)!=="at " && isNodeJs(line)) {
                          line = lines.shift();
                    }
                    
                    if (line) {
                        console.log(_app.colors.normal+"          code    :   "+_app.colors.green+line.trim()+_app.colors.normal);
                    }
                    console.log("          Run Time:   " + ( failedTestFN.duration > 500 ? _app.colors.red : failedTestFN.duration > 250 ? _app.colors.yellow : _app.colors.green )+String(failedTestFN.duration /1000)+_app.colors.normal );
                    console.log("          Source:      ");
                    indentStr(javascript.colorize(failedTestFN.toString()),22);
                     var 
                    log_array = failedTestFN.test_console_log;
                    if (log_array) {
                        console.log("          Console Output:      ");
                        log_array.forEach(function(logEntry){
                            if (logEntry.log) {
                                console.log.apply(console,logEntry.log);
                            }
                            if (logEntry.dir) {
                                console.dir.apply(console,logEntry.dir);
                            }
                        });
                        log_array.splice(0,log_array.length);
                        delete failedTestFN.test_console_log;

                    }
                    console.log("");
                    console.log(hr);
                    console.log(""); 
                   
                });
            }

        });
        console.log("");    
    }

};

var getTestCount = function() {
   return Object.keys(_app.tests).reduce(function(sum,testSetName){
       return sum + Object.keys(_app.tests[testSetName]).length;
   },0);  
};

var clearTestSetStats = function(testSetName){
    var testSet = _app.tests[testSetName];
    _app.setStats[testSetName] = {
       count    : 0,
       passes   : 0,
       errors   : []
    };
    Object.keys(testSet).forEach(function(testName,ix){
        var testFN = testSet[testName];
        testFN.state="not run";
        testFN.index = ix+1;
        delete testFN.exception;
        delete testFN.started;
        delete testFN.finished;
    });
}; 

var clearTestStats = function () {
    var testSetNames = Object.keys(_app.tests);
    _app.setStats = {};
    testSetNames.forEach(clearTestSetStats);
    _app.stats = {
        count    : 0,
        passes   : 0,
        errors   : []
    };
};

var right_pad=function(text,pad,color) {
   return _app.colors[color]+(new Array(pad+1).join(" ")+text).substr(0-pad)+_app.colors.normal;
};

var left_pad=function(text,pad,color) {
   return _app.colors[color]+(text +new Array(pad+1).join(" ")).substr(0,pad)+_app.colors.normal;
};

var msec_pad=function(testFN,pad,color) {
   return right_pad(String(testFN.finished-testFN.started),pad,color);
};

var testLogUpdate = function (testFN,testSetName,STAT,statColor) {
    console.log( left_pad("[" + testSetName + " # "+testFN.index+"]",14,"normal")+
    _app.colors[statColor] +" "+STAT.substr(0,4)+" "+
    msec_pad(testFN,6,"blue") +" "+
    left_pad(testFN.testName,process.stdout.columns-30,"yellow"));
};

var onTestPass = function(testSet,testSetName,testFN,done) {
    testFN.state="passed";
    _app.stats.count  ++;
    _app.stats.passes ++;
    _app.setStats[testSetName].count  ++;
    _app.setStats[testSetName].passes ++;
    _app.setStats[testSetName].finished = testFN.finished;
    
    testLogUpdate(testFN,testSetName,"PASS","green");
    
    done();
};

var onTestFail = function(testSet,testSetName,testFN,exception,done) {
    testFN.state="failed";
    testFN.exception=exception;
    _app.stats.count    ++;
    _app.stats.errors.push (testFN);
    
    _app.setStats[testSetName].count    ++;
    _app.setStats[testSetName].errors.push (testFN);
    _app.setStats[testSetName].finished = testFN.finished;
    testLogUpdate(testFN,testSetName,"FAIL","red");
    done();
};

var runTest=function(testSet,testSetName,testName,done){
    
    if ( typeof testSet==='object' && 
         typeof testSetName==='string' && 
         typeof testName==='string' && 
         typeof done==='function' ) {
             
        var testFN = testSet[testName];
        testFN.testName = testName;
        testFN.state = "running";
        // if a test runs away on us and calls done() more than once, 
        // we need to ignore extra calls, so wwe use a repeatKill flag to detect this
        var repeatKill=false;
        
        // if a  test does not complete after 10 seconds,it can indicate a bug)
        // so we start a timeout before each test, and nix it when the test completes or fails
        var doneCompleted,
             
            timeoutChecker = function(){
                 var elapsed = Date.now()-testFN.started;
                 if ( elapsed < _app.timeout) {
                     testFN.finished = Date.now();
                     testLogUpdate(testFN,testSetName,"WAIT","red");
                     return (doneCompleted = setTimeout(timeoutChecker,_app.timeout_log_every));
                 }
                 doneCompleted=false;
                 repeatKill = true;
                 var message = "Test did not complete after "+String(Math.round(_app.timeout/1000))+" seconds";
                 testFN.finished = Date.now();
                 onTestFail(testSet,testSetName,testFN,
                     new Error(message),
                     done);
             };
        doneCompleted = setTimeout(timeoutChecker,_app.timeout_log_after);
        
        
        var 
        global_trap,
        err_callback = function (exception) {
            
            if (doneCompleted) {
                clearTimeout(doneCompleted);
                doneCompleted=false;
            }
            
            if (repeatKill) {
                // an exception after done() was called 
                console.log(_app.colors.red + "WARNING: LATE EXCEPTION - AFTER done()" + _app.colors.normal);
                console.dir({
                    "Test Set"  : testSetName,
                    "Test Name" : testName,
                    "Error"     : exception
                },{colors:true});
                return;
            }
            
            onTestFail(testSet,testSetName,testFN,exception,done);
        };
        
        global_trap = function (exception) {
                testFN.finished = Date.now();
                console.log  = console.__swizzled.log;
                console.dir  = console.__swizzled.dir;
                process.removeListener('uncaughtException',global_trap);
                err_callback(exception);
        };
        
        process.on('uncaughtException',global_trap);
        
        try {

            if (testFN.test_console_log) {
                testFN.test_console_log.splice(0,testFN.test_console_log.length);
                delete testFN.test_console_log;
            }
            
            console.__swizzled = console.__swizzled || { log: console.log, dir : console.dir};
            console.log = function log (){
                var 
                logEntry = {log: Array.prototype.slice.call(arguments)},
                log_array = testFN.test_console_log ? testFN.test_console_log : (testFN.test_console_log=[]); 
                log_array.push(logEntry);
            };
            console.dir = function  dir (){
                var 
                logEntry = {dir: Array.prototype.slice.call(arguments)},
                log_array = testFN.test_console_log ? testFN.test_console_log : (testFN.test_console_log=[]); 
                log_array.push(logEntry);
            };
            
            testFN.started = Date.now();
            testFN(function(){
                var stamp = Date.now();
                console.log  = console.__swizzled.log;
                console.dir  = console.__swizzled.dir;
                
                
                if (doneCompleted) {
                    clearTimeout(doneCompleted);
                    doneCompleted=false;
                }
                
                if (repeatKill) {
                    // if a test runs away on us and calls done more than once, 
                    // we need to ignore extra calls
                    testLogUpdate(testFN,testSetName,"REPT","red");
                    
                    return;
                }
                testFN.finished = stamp;
                repeatKill=true;
                
                process.removeListener('uncaughtException',global_trap);
                
                onTestPass(testSet,testSetName,testFN,done);
                
            });
            
        } catch (exception) {
            
            testFN.finished = Date.now();
            console.log  = console.__swizzled.log;
            console.dir  = console.__swizzled.dir;
            process.removeListener('uncaughtException',global_trap);
            err_callback(exception);
            
        }
        
    } else {
        
        throw new Error("runTest(testSet,testSetName,testName,done) called with bad arguments");
        
    }
};

// main test iterator
_app.run = function(failLimit,testLimit,cb){
    
    var testCount = getTestCount ();
    testLimit = typeof testLimit === 'number' && testLimit < testCount ? testLimit : testCount;
    failLimit = typeof failLimit === 'number' && failLimit < testLimit ? failLimit : testLimit;
    var testSetNames = Object.keys(_app.tests);
    
    clearTestStats();
    // _app.stats.finished = _app.stats.started = Date.now() ;
    
    // runTestSet will be called once for each element index of testSetName 
    var runTestSet = function (i) {
        
        if (i>= testSetNames.length) {
            
            printReport(failLimit,testLimit);
            
            // save the source code version file
            testSetNames.forEach(function(testSetName){
                 var sha256Info     = _app.setStatJSON[testSetName];
                 var versionFile = sha256Info.fn;
                 sha256Info.results = _app.setStats[testSetName];
                 delete sha256Info.fn;
                 fs.writeFileSync(versionFile,JSON.stringify(sha256Info));
            });
            
            if (typeof cb==='function') {
                cb();
            }
            
        } else {
            var testSetName = testSetNames[i],
            testSet = _app.tests[testSetName];
            
            var testNames  = Object.keys(testSet);

            // runTestX will be called once for each element index of testSet testNames
            var runTestX = function (x) {
                if (x>= testNames.length) {
                    _app.setStats[testSetName].started =  testSet[ testNames[0] ].started;
                    runTestSet(++i);
                } else {
                    var testName = testNames[x];
                        
                    // asyncronously perform the test
                    runTest(testSet,testSetName,testName, function (){
                        var statsx = _app.setStats[testSetName];
                        _app.stats.finished = statsx.finished ; 
                        if ( ( _app.stats.errors.length <= failLimit) && ( _app.stats.count <= testLimit) ) {
                            
                            runTestX(++x);
                        } else {
                          
                            console.log( 
                            _app.colors.yellow + testSetName +
                              ( statsx.errors.length===0 ? _app.colors.green +" PASS " : _app.colors.red +" FAIL")+
                              _app.colors.blue + "("+String(statsx.finished-statsx.started)+" msec)");
       
                            runTestSet(testSetNames.length);
                        }
                    });
                }
            };
            
            runTestX(0);
            
           
            
        }
        
    };
    
    runTestSet(0);

    
    
};

// auto load the tests.json file
(function (testPathsJSON) {
    var testPaths = JSON.parse(testPathsJSON);
    console.log("Test configuration: (in test/tests.json)");
    console.dir(testPaths,{colors:true});
    selfTestNeeded = sourceCodeTestNeeded("selfTest",__filename);

    if (selfTestNeeded) {
        _app.tests.selfTest = {
            
            "always passes" : function (done) {
                assert.ok(true);
                done();
            },
            
            "never passes" : function (done) {
                assert.ok(false);
                done();
            },
            "never completes" : function (done) {
        
            },
        } ;
    }
    
    Object.keys(testPaths).forEach(function(testSetName){
        runTestsIfNeeded (testSetName,testPaths[testSetName]);
    });
    
})(fs.readFileSync(path.join(path.dirname(__filename),"tests.json")));

if (selfTestNeeded) {
    console.log(
        _app.colors.magenta+
        "NOTE - the internal 'selfTest' intentionally has multiple fail messages,\n"+
        "       This is to properly test the fail reporting mechanism.\n"+
        "       Also, one of the self tests never completes, on purpose.\n"+
        "       'selfTest' only runs if you have changed "+path.basename(__filename)+
         _app.colors.normal
        
   );
}

// start the tests
_app.run();