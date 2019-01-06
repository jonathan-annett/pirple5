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

//lib.logFileName --> a string "path/to/filename/lib-??????.json"
lib.logFileName=function(f) {
    switch (typeof f) {
      case 'string' :
        if (f.substr(0,lib.basedir.length)===lib.basedir) {
            return f;
        }
        return path.join(lib.basedir,f);
      case 'object' : 
        if (f.constructor===Date) {
            return lib.logFileName(f.getTime());
        }
        break;
      case 'number' :
          return path.join(lib.basedir,"log-"+f.toString(36)+".json");
    }
    return false;
};

lib.logFileEpoch=function(f) {
    switch (typeof f) {
      case 'string' :
        var parse = f.split("log-");
        if (parse && parse.length>1) {
            parse = parse.pop();
            var parse2 = parse.split(".jso");
            if (parse2.length===2 && parse2[1]==="n") {
                return Number.parseInt(parse2[0],36);
            }
            parse2 = parse.split(".json.g");
            if (parse2.length===2 && parse2[1]==="z") {
                return Number.parseInt(parse2[0],36);
            }
        }
        break;
      case 'object' : 
        if (f.constructor===Date) {
            return f.getTime();
        }
        break;
      case 'number' :
          return f;
    }
    return false;
};

lib.compressedLogFileName=function(f) {
    f = lib.logFileEpoch (f);
    if (f===false) return false;
    return path.join(lib.basedir,"log-"+f.toString(36)+".json.gz");
};

lib.listLogs = function(opt,cb){
    if (typeof opt === 'function') {
        cb=opt;
        opt={};
    }   
    opt=opt||{};
    
    fs.readdir(lib.basedir,function(err,files){
        
        if (err||!files) return cb(err||new Error("files not returned file fs.readdir"));
        
        files = files.map(function(fn){

            var result = null;
            
            var epoch = lib.logFileEpoch(fn);
            var compressed = fn.indexOf(".json.gz")>0;
            var needed = false;
            if (opt.all) {
                needed = true;
            } else {
                if (opt.compressed && compressed) needed = true;
                if (!opt.compressed && !compressed) needed = true;
            }
            if (needed && opt.before_epoch){
                if (epoch >= opt.before_epoch) {
                    needed = false;
                }
            }
            if (needed && opt.after_epoch){
                if (epoch <= opt.after_epoch) {
                    needed = false;
                }
            }
            if (needed){
                result = {
                    epoch : epoch,
                    compressed : compressed,
                    fn : path.join(lib.basedir,fn)
                };

                if (opt.getter && compressed) {
                    result.get=function(cb){
                        lib.decompressFile(epoch,function(err,epoch,fn,most_recent) {
                            if (err) {return cb(err)}
                            fs.readFile(fn,function(err,buffer){
                                if (err||!buffer) {return cb(err|| new Error("fs.readFile did not return buffer"))}
                                
                                try {
                                    cb(false,JSON.parse(buffer),most_recent);
                                } catch (e) {
                                    cb(e);
                                }
                            });
                        });
                    };
                }
                
                if (opt.getter && !compressed) {
                    result.get=function(cb){
                        fs.stat(result.fn,function(err,stat){
                            if (err||!stat) {return cb(err|| new Error("fs.stat did not return stats"))}
                            fs.readFile(result.fn,function(err,buffer){
                                if (err||!buffer) {return cb(err|| new Error("fs.readFile did not return buffer"))}
                                try {
                                    cb(false,JSON.parse(buffer),stat.mtime.getTime());
                                } catch (e) {
                                    cb(e);
                                }
                            });
                        });
                        
                    };
                }
                
            }
            return result;

        });
        files = files.filter(function(x){
           return x !== null; 
        });
        files = files.sort(function(a,b){
            if (a.epoch > b.epoch) return 1;
            if (a.epoch < b.epoch) return -1;
            return 0;
        });
        
        cb(files);
    });
};

lib.createFile = function (firstEntry,cb){
    var when = Date.now();
    var fn = lib.logFileName(when);
    if (fn===false) throw new Error("Unknown error establishing log filename");

    var file_string = JSON.stringify([when,firstEntry]);
    
    fs.writeFile(fn,file_string,function(err){
        if (err) {
          return cb(err);  
        }   
        cb(false,fn,firstEntry);
    });
    return fn;
};

//lib.extendFile --> cb(false,fn,nextEntry)
lib.extendFile = function (f,nextEntry,cb){
    var when = Date.now();
    var fn = lib.logFileName(f);
    if (fn===false) return cb(new Error("invalid log filename"));
    if (typeof nextEntry!=='object') {
         cb(new Error("invalid log Entry"));       
    }
    var buffer = new Buffer(",\n"+JSON.stringify([when,nextEntry]).substr(1));
    fs.stat(fn,function(err,stats){
        if (err||!stats) return cb(err);
        fs.open(fn,'r+',function(err,fd){
            if (err||!fd) return cb(err);
            fs.write(fd,buffer,/*buffer offset*/0,buffer.length,/*file offset*/stats.size-1,function(errWrite){
                fs.close(fd,function(errClose){
                   if (errWrite) {
                       return cb(errWrite);
                   }
                   if (errClose) {
                       return cb(errClose);
                   }
                   
                   return cb(false,fn,nextEntry);
               }); 
            });
        });
    });
    
};

lib.arrayExtendFile = function (f,nextEntries,cb){
    var when = Date.now();
    var fn = lib.logFileName(f);
    if (fn===false) return cb(new Error("invalid log filename"));
    if (typeof nextEntries!=='object' || nextEntries.constructor!==Array || nextEntries.length===0) {
         cb(new Error("invalid log Entries"));       
    }
    var stampedEntries=[];
    nextEntries.forEach(function(e){
        stampedEntries.push(when);
        stampedEntries.push(e);
    });
    var buffer = new Buffer(",\n"+JSON.stringify(stampedEntries).substr(1));
    fs.stat(fn,function(err,stats){
        if (err||!stats) return cb(err);
        fs.open(fn,'r+',function(err,fd){
            if (err||!fd) return cb(err);
            fs.write(fd,buffer,/*buffer offset*/0,buffer.length,/*file offset*/stats.size-1,function(errWrite){
               fs.close(fd,function(errClose){
                   if (errWrite) {
                       return cb(errWrite);
                   }
                   if (errClose) {
                       return cb(errClose);
                   }
                   
                   return cb(false,fn,nextEntries);
               }); 
            });
        });
    });
    
};

//lib.compressFile --> cb(err,epoch,fn,most_recent)
lib.compressFile= function(f,cb){
   var epoch = lib.logFileEpoch(f);
   if (!epoch) return cb(new Error("invalid log handle"));
   var before_fn = lib.logFileName(epoch);
   if (!before_fn) return cb(new Error("invalid log before_fn"));
   var after_fn = lib.compressedLogFileName(epoch);
   if (!after_fn) return cb(new Error("invalid log after_fn"));
  
   fs.stat(after_fn,function(err_after,stat_after){
       if (!err_after && stat_after && stat_after.mtime) {
           // file is already compressed - we are done
           return cb (false,epoch,after_fn,stat_after.mtime.getTime());
       }
       fs.stat(before_fn,function(err_before,stat_before){
           if (err_before || !stat_before ) {
               return cb(new Error("can't find log file to compress"));
           }
           
            var gzip = zlib.createGzip();
            var inp = fs.createReadStream(before_fn);
            var out = fs.createWriteStream(after_fn);
            
            inp // read uncompressed input from before_fn
                .pipe(gzip) // compresses via gzip
                .pipe(out)  // write compressed data to after_fn
                .on('finish', function () {  
                     fs.stat(after_fn,function(err_after,stat_after){
                         if (!err_after && stat_after && stat_after.mtime) {
                             return cb (false,epoch,after_fn,stat_after.mtime.getTime());
                         }
                     });
                });

       });
   });      
   
};

//lib.decompressFile --> cb(err,epoch,fn,most_recent)
lib.decompressFile= function(f,cb){
   var epoch = lib.logFileEpoch(f);
   if (!epoch) return cb(new Error("invalid log handle"));
   var before_fn = lib.compressedLogFileName(epoch);
   if (!before_fn) return cb(new Error("invalid log before_fn"));
   var after_fn = lib.logFileName(epoch);
   if (!after_fn) return cb(new Error("invalid log after_fn"));
  
   fs.stat(after_fn,function(err_after,stat_after){
       if (!err_after && stat_after && stat_after.mtime) {
           // file is already decompressed - we are done
           return cb (false,epoch,after_fn,stat_after.mtime.getTime());
       }
       fs.stat(before_fn,function(err_before,stat_before){
           if (err_before || !stat_before ) {
               return cb(new Error("can't find log file to decompress"));
           }
           
            var gunzip = zlib.createGunzip();
            var inp = fs.createReadStream(before_fn);
            var out = fs.createWriteStream(after_fn);
            inp // read compressed input from before_fn
            .pipe(gunzip) // uncompresses via gunzip
            .pipe(out)  // write decompressed data to after_fn
            .on('finish', function () {  
                 fs.stat(after_fn,function(err_after,stat_after){
                     if (!err_after && stat_after && stat_after.mtime) {
                         return cb (false,epoch,after_fn,stat_after.mtime.getTime());
                     }
                 });
            });

       });
   });      
   
};

lib.currentLogFile = false;

lib.init = function(cb){
    // ensure the log storeage path exists
    fs.mkdir(lib.basedir,function(err){
       if (!err) {
           console.log("created "+lib.basedir);
       }   
       var startupEntry = { message : "Logging Has Started" };
       
       lib.listLogs(function(list){
           if (list.length === 0) {
               lib.createFile ({message:"New Log File Created"},function(err,fn,firstEntry){
                   
                   if (err) {
                       return console.log({err:err});
                   }
                   
                   lib.currentLogFile  = fn;
                   console.log({newLogFile:lib.currentLogFile,firstEntry:firstEntry});
                   
                   lib.extendFile (fn,startupEntry,function(err,fn,nextEntry){
                       if (err) {
                           return console.log({err:err});
                       }
                       console.log({loggingStarted:{fn,nextEntry}});
                   });
                   
                   if (typeof cb==="function") cb();   
               });
           } else {
               lib.currentLogFile  = list[list.length-1].fn;
               lib.extendFile(lib.currentLogFile,startupEntry,function(err,fn,nextEntry){
                   if (err) {
                       return console.log({err:err});
                   }
                   console.log({loggingStarted:{fn,nextEntry}});
               });
           }
       });
       
       
       

        
    });
};


if (process.mainModule===module) lib.init();