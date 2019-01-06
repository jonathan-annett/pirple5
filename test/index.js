
var [assert] = [require("assert")];

var _app = module.exports = {};

_app.tests    = {};
_app.stats    = {};
_app.setStats = {};

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

var getTestCount = function() {
   return Object.keys(_app.tests).reduce(function(sum,testSetName){
       return sum + Object.keys(_app.tests[testSetName]).length;
   },0);  
};

var onTestPass = function(testSet,testSetName,testFN) {
    testFN.state="passed";
    _app.stats.count  ++;
    _app.stats.passes ++;
    _app.setStats[testSetName].count  ++;
    _app.setStats[testSetName].passes ++;
};

var onTestFail = function(testSet,testSetName,testFN,exception) {
    testFN.state="failed";
    testFN.exception=exception;
    _app.stats.count    ++;
    _app.stats.errors.push (testFN);
    
    _app.setStats[testSetName].count    ++;
    _app.setStats[testSetName].errors.push (testFN);
};

var runTest=function(testSet,testSetName,testName){
    if (typeof testSet==='object' && typeof testName==='string') {
        var testFN = testSet[testName];
        testFN.testName = testName;
        testFN.state = "running";
        
        if (testFN.exception) 
            delete testFN.exception;
        try {
            // if a test runs away on us and calls done more than once, 
            // we need to ignore extra calls, so wwe use a repeatKill flag to detect this
            var repeatKill=false;
            testFN.started = Date.now();
            testFN(function(){
                var stamp = Date.now();
                if (repeatKill) {
                    // if a test runs away on us and calls done more than once, 
                    // we need to ignore extra calls
                    return;
                }
                testFN.finished = stamp;
                repeatKill=true;
                onTestPass(testSet,testSetName,testFN);
            });
        } catch (exception) {
            testFN.finished = Date.now();
            onTestFail(testSet,testSetName,testFN,exception);
        }
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
                    console.log("          Run Time:   "+ String(failedTestFN.duration /1000) );
                    console.log("          Source:      ");
                    indentStr(String(failedTestFN.toString()),16,1,1);
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

_app.run = function(failLimit,testLimit){
    
    var testCount = getTestCount ();
    testLimit = typeof testLimit === 'number' && testLimit < testCount ? testLimit : testCount;
    failLimit = typeof failLimit === 'number' && failLimit < testLimit ? failLimit : testLimit;
    var testSetNames = Object.keys(_app.tests);
    
    clearTestStats();
    var lastFinish = _app.stats.started = Date.now() ;
    testSetNames.some(function(testSetName){
        var testSet    = _app.tests[testSetName];
        var testNames  = Object.keys(testSet);
        var lastFinish = _app.setStats[testSetName].started = Date.now();
        
        var tester = function(testName){ 
            runTest(testSet,testSetName,testName);
            lastFinish = testSet[testName].finished;
            return ( _app.stats.failures <= failLimit) && ( _app.stats.count <= testLimit);
        };
        
        var testsDone = testNames.some(tester);
        
        _app.setStats[testSetName].finished = lastFinish; 
        
        return testsDone;
        
    });
    _app.stats.finished = lastFinish;
    
    printReport(failLimit,testLimit);
};

_app.run();