/*

this is a log file manager.

it occurred to me that my previous 4 projects did not formally handle logging,
even though earlier lessons covered that topic. 

Since previous assignments did not specify logging at all, I never implemented logging

tests will include that all log files created must be valid json, or compressed valid json


*/

var [ fs, 
      path,
      zlib,
    ] = "fs,path,zlib".split(",").map(require);


var lib = module.exports = {};

console.log(zlib);
