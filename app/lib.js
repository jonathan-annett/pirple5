/*

this is a log file manager.

it occurred to me that my previous 4 projects did not formally handle logging,
even though earlier lessons covered that topic. 

Since previous assignments did not specify logging at all, I never implemented logging

tests will include that all log files created must be valid json, or compressed valid json


*/

/* explode-require the node-libs we need */
var [ fs, path, zlib ] = "fs,path,zlib".split(",").map(require);


var lib = module.exports = {};

lib.basedir = path.join(__dirname,'..','.logs');

lib.init = function(cb){
    fs.mkdir(lib.basedir,function(err){
       if (!err) {
           console.log("created "+lib.basedir);
       } 
    });
};

if (process.mainModule===module) lib.init();