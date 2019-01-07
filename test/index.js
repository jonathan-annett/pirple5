
var [assert] = "assert".split(",").map(require);

var _app = module.exports = {};

_app.timeout = 10000;

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
_app.colors.symbol  = _app.colors.red;
_app.colors.property  = _app.colors.magenta;
_app.colors.error   = _app.colors.red;
_app.colors.keyword = _app.colors.green;
_app.colors.reserved = _app.colors.cyan;
_app.colors.string = _app.colors.yellow;

var javascript = {
    reserved : "done.assert.abstract.arguments.await.boolean.break.byte.case.catch.char.class.const.continue.debugger.default.delete.do.double.else.enum.eval.export.extends.false.final.finally.float.for.function.goto.if.implements.import.in.instanceof.int.interface.let.long.native.new.null.package.private.protected.public.return.short.static.super.switch.synchronized.this.throw.throws.transient.true.try.typeof.var.void.volatile.while.with.yield".split("."),
    properties : "hasOwnProperty.Infinity.isFinite.isNaN.isPrototypeOf.length.Math.NaN.name.Number.Object.prototype.String.toString.undefined.valueOf".split("."),
};

javascript.colors = {
    reserved : javascript.reserved.map(function(token){ return _app.colors.reserved+token+_app.colors.normal;}),
    properties : javascript.properties.map(function(token){ return _app.colors.property+token+_app.colors.normal;}),
   
};

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

var getTestCount = function() {
   return Object.keys(_app.tests).reduce(function(sum,testSetName){
       return sum + Object.keys(_app.tests[testSetName]).length;
   },0);  
};

var onTestPass = function(testSet,testSetName,testFN,done) {
    testFN.state="passed";
    _app.stats.count  ++;
    _app.stats.passes ++;
    _app.setStats[testSetName].count  ++;
    _app.setStats[testSetName].passes ++;
    done();
};

var onTestFail = function(testSet,testSetName,testFN,exception,done) {
    testFN.state="failed";
    testFN.exception=exception;
    _app.stats.count    ++;
    _app.stats.errors.push (testFN);
    
    _app.setStats[testSetName].count    ++;
    _app.setStats[testSetName].errors.push (testFN);
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
        var doneCompleted = setTimeout(function(){
            doneCompleted=false;
            repeatKill = true;
            onTestFail(testSet,testSetName,testFN,
                new Error("Test did not complete after "+String(_app.timeout/1000)+" seconds"),
                done);
        },_app.timeout);
        
        
        var 
        global_trap,
        err_callback = function (exception) {
            
            if (doneCompleted) {
                clearTimeout(doneCompleted);
                doneCompleted=false;
            }
            
            if (repeatKill) {
                // an exception after done() was called is not necessarily
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
                process.removeListener('uncaughtException',global_trap);
                err_callback(exception);
        };
        
        process.on('uncaughtException',global_trap);
        
        try {

            testFN.started = Date.now();
            testFN(function(){
                var stamp = Date.now();
                
                if (doneCompleted) {
                    clearTimeout(doneCompleted);
                    doneCompleted=false;
                }
                
                if (repeatKill) {
                    // if a test runs away on us and calls done more than once, 
                    // we need to ignore extra calls
                    return;
                }
                testFN.finished = stamp;
                repeatKill=true;
                
                process.removeListener('uncaughtException',global_trap);
                onTestPass(testSet,testSetName,testFN,done);
                
            });
        } catch (exception) {
            testFN.finished = Date.now();
            process.removeListener('uncaughtException',global_trap);
            err_callback(exception);
        }
        
    } else {
        
        throw new Error("runTest(testSet,testSetName,testName,done) called with bad arguments");
        
    }
};

var clearTestSetStats = function(testSetName){
    var testSet = _app.tests[testSetName];
    _app.setStats[testSetName] = {
       count    : 0,
       passes   : 0,
       errors   : []
    };
    Object.keys(testSet).forEach(function(testName){
        var testFN = testSet[testName];
        testFN.state="not run";
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

var printReport = function(failLimit,testLimit) {
    var hr = Array(process.stdout.columns).join("-");
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
        
        lines.forEach(function(line){console.log(Array(indent+1).join(" ")+line);});
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
    
    
    collateStats(_app.stats);
    
    testSetNames.forEach(function(testSetName){
        var stats = _app.setStats[testSetName];
        
        collateStats(stats);
        
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
    console.log("      Tests Run: "+testLimit+" ( limited to "+failLimit+" failures)");
    console.log("      Passes:    "+_app.stats.passes);
    console.log("      Failures:   "+_app.stats.errors.length);
    console.log("      Run Time:   "+ String(_app.stats.duration /1000) );
    console.log("");
    console.log(hr);
    console.log("");
    console.log("      Breakdown:");
    console.log("         Test sets: "+testSetNames.length);
    
    testSetNames.forEach(function(testSetName){
        var stats = _app.setStats[testSetName];
        console.log("         "+testSetName+" :  ");
        console.log("          Passes:    "+stats.passes);
        console.log("          Failures:   "+stats.errors.length);
        console.log("          Run Time:   "+ String(stats.duration /1000) );
        console.log("");
    });
    console.log(hr);
    console.log("");
    if (_app.stats.errors.length) {
        console.log("   Errors");    
        console.log("");    
        testSetNames.forEach(function(testSetName){
            var stats = _app.setStats[testSetName];
            if (stats.errors.length>0) {
                console.log("         "+testSetName+" :  ");
                stats.errors.forEach(function(failedTestFN){
                    console.log("          Test:       "+failedTestFN.testName);
                    console.log("          Error:");
                    indentStr(String(failedTestFN.exception),16);
                    indentStr(String(failedTestFN.exception.stack),16,1);
                    console.log("          Run Time:   "+ String(failedTestFN.duration /1000) );
                    console.log("          Source:      ");
                    indentStr(javascript.colorize(failedTestFN.toString()),16);
                    console.log(""); 
                });
            }
            console.log("");
            console.log(hr);
        
        });
        console.log("");    
    }
    
    console.log(hr);
};

_app.run = function(failLimit,testLimit,cb){
    
    var testCount = getTestCount ();
    testLimit = typeof testLimit === 'number' && testLimit < testCount ? testLimit : testCount;
    failLimit = typeof failLimit === 'number' && failLimit < testLimit ? failLimit : testLimit;
    var testSetNames = Object.keys(_app.tests);
    
    clearTestStats();
    var lastSetFinish = _app.stats.started = Date.now() ;
    
    // runTestSet will be called once for each element index of testSetName keys
    var runTestSet = function (i) {
        
        if (i>= testSetNames.length) {
            _app.stats.finished = lastSetFinish; 
            printReport(failLimit,testLimit);
            if (typeof cb==='function') {
                cb();
            }
        } else {
            var testSetName = testSetNames[i],
            testSet = _app.tests[testSetName];
            
            var testNames  = Object.keys(testSet);
            var lastFinish = _app.setStats[testSetName].started = Date.now();

            // runTestX will be called once for each element index of testSet keys
            var runTestX = function (x) {
                if (x>= testNames.length) {
                    runTestSet(++i);
                } else {
                    var testName = testNames[x];
                        
                    // asyncronously perform the test
                    runTest(testSet,testSetName,testName, function (){
                        lastFinish = testSet[testName].finished;
                        if ( ( _app.stats.errors.length <= failLimit) && ( _app.stats.count <= testLimit) ) {
                            runTestX(++x);
                        } else {
                            runTestSet(testSetNames.length);
                        }
                    });
                }
            };
            runTestX(0);

            _app.setStats[testSetName].finished = lastFinish; 
            
        }
        
    };
    

    runTestSet(0);

    
    
};

_app.tests    = {};
_app.stats    = {};
_app.setStats = {};

/*
_app.tests.selfTest = {
    
    "always passes" : function (done) {
        assert.ok(true);
        done();
    },
    
    "never passes" : function (done) {
        assert.ok(false);
        done();
    },
} ;
*/
_app.tests.lib = require("../app/lib").tests;

_app.run();