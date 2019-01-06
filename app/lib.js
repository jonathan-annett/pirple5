/*

this is a log file manager.


*/

/*
Copyright 2019 Jonathan Annett
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

"use strict";
/* explode-require the node-libs we need */
var [ fs, path, zlib ] = "fs,path,zlib".split(",").map(require);

/* lib is exported */
var lib = module.exports = {};

lib.config = {
    maxLogSizeBytes            : 1024*1024,
    maxLogEntriesPerFile       : 10,
    maxLogHoursPerFile         : 0.1,
    maxUncompressedFileCount    : 5,
    max_file_cache          : 10,
};

lib.basedir = path.join(__dirname,'..','.logs');

//lib.logFileName(f) --> a String "path/to/filename/lib-??????.json"
// f can be a String(filename), a Date or a Number (timestamp)
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

//lib.logFileEpoch(f) --> a Number = timestamp of first entry in file
// f can be a String(filename), a Date or a Number (timestamp)
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

//lib.logFileEpoch(f) --> a String "path/to/filename/lib-??????.json.gz"
// f can be a String(filename), a Date or a Number (timestamp)
lib.compressedLogFileName=function(f) {
    f = lib.logFileEpoch (f);
    if (f===false) return false;
    return path.join(lib.basedir,"log-"+f.toString(36)+".json.gz");
};

lib.createLogListItemGetter = function(item){
    if (item.compressed) {
        item.get=function(cb){
            lib.decompressFile(item.epoch,function(err,epoch,fn,most_recent) {
                if (err) {return cb(err)}
                fs.stat(fn,function(err,stat){
                    if (err||!stat) {return cb(err|| new Error("fs.stat did not return stats"))}
                    item.uncompressed_size = stat.size;
                    fs.readFile(fn,function(err,buffer){
                        if (err||!buffer) {return cb(err|| new Error("fs.readFile did not return buffer"))}
                        
                        try {
                            cb(false,JSON.parse(buffer),most_recent);
                        } catch (e) {
                            cb(e);
                        }
                    });
                });
                
            });
        };
    }
    if (!item.compressed) {
        item.get=function(cb){
            fs.stat(item.fn,function(err,stat){
                if (err||!stat) {return cb(err|| new Error("fs.stat did not return stats"))}
                item.uncompressed_size = stat.size;
                fs.readFile(item.fn,function(err,buffer){
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
};

lib.createLogListItem = function (opt,fn) {

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

       if ( opt.getter ) {
           lib.createLogListItemGetter(result);
       }

   }
   return result;

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
           return lib.createLogListItem(opt,fn); 
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

    var file_string = JSON.stringify([{t:when,e:firstEntry}]);
    
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
    
    // make a buffer we will use to extend the file, which omits the opening [
    var buffer = new Buffer(",\n"+(JSON.stringify([{t:when,e:nextEntry}]).substr(1)));
    
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
        stampedEntries.push({t:when,e:e});
    });
    // make a buffer we will use to extend the file, which omits the opening [
    var buffer = new Buffer(",\n"+(JSON.stringify(stampedEntries).substr(1)));
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
                             
                             fs.unlink(before_fn,function(err){
                                
                                if (err) return cb(err);
                                
                                return cb (false,epoch,after_fn,stat_after.mtime.getTime()); 
                             });
                            
                         }
                         return cb (err_after);
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
                         fs.unlink(before_fn,function(err){
                         
                             if (err) return cb(err);
                             return cb (false,epoch,after_fn,stat_after.mtime.getTime());
                         
                         });
                     }
                     return cb(err_after);
                 });
            });

       });
   });      
   
};


lib.getEntriesCache={};
lib.getEntriesCache_=[];
lib.getEntries = function(epoch,cb){
    
    
    var res = lib.getEntriesCache[epoch];
    
    if (res) {
        
        var ix  = lib.getEntriesCache_.indexOf(epoch);
        if (ix>0) {
            lib.getEntriesCache_.splice(ix,1);
            lib.getEntriesCache_.unshift(epoch);
        }
        
        return cb(false,res);
    }
    
   lib.decompressFile(epoch,function(err,epoch,fn){
       
       if (err) return cb(err);
       fs.readFile(fn,function(err,buffer){
           try {
               
               var entries = JSON.parse(buffer);
              
               //cache the data we just read, and 
               lib.getEntriesCache[epoch]=entries;
               lib.getEntriesCache_.unshift(epoch);
               
               // remove the least used cache entry files if there are too many cached
               while (lib.getEntriesCache_.length > lib.config.max_file_cache) {
                   delete lib.getEntriesCache[ lib.getEntriesCache_.pop() ];
               } 
               
               cb(false,entries);
           } catch (e) {
               cb(e);
           }
       });
   });  
};

lib.getMostRecentLogEntries = function ( count, cb  ) {
     
};

lib.getLogPreviousEntries = function ( entries, count, cb  ) {

};

lib.getLogNextEntries = function ( entries, count, cb  ) {

};

lib.currentLogFile = false;

lib.log = function ( logEntry, cb ) { 
    if (typeof logEntry === 'function') {
        cb = logEntry;
        logEntry = undefined;
    }
    var newFile = function () {
        lib.createFile ({message:"New Log File Created"},function(err,fn){
            
            if (err) {
                return console.log({err:err});
            }
            
            // create lib.currentLogFile as a single list item entry 
            // (it will not live in a list however, we just need one as there is no "last log file used")
            
            if (lib.currentLogFile && lib.currentLogFile.entries) {
                lib.getEntriesCache[lib.currentLogFile.epoch] = lib.currentLogFile.entries;
                lib.getEntriesCache_.push(lib.currentLogFile.epoch);
                delete lib.currentLogFile.entries;
                delete lib.currentLogFile;
            }
            
            lib.currentLogFile  = lib.createLogListItem({getter:true},path.basename(fn));
            
            if (typeof logEntry === 'object') {
    
                lib.extendFile (fn,logEntry,function(err,fn,nextEntry){
                    
                    if (err) {
                        return console.log({err:err});
                    }
                    lib.currentLogFile.entries = [nextEntry];
                    if (typeof cb==="function") cb(undefined,fn,nextEntry);  
                });
            
            } else {
                lib.currentLogFile.entries = [];
                if (typeof cb==="function") cb(undefined,fn);   
                
            }
        });
    };
    
    if (typeof lib.currentLogFile === 'undefined') {
        return newFile();
    }
    

    if (typeof lib.currentLogFile.get === 'function') {
        return lib.currentLogFile.get(function(err,entries){
            
            console.log({LogFileEntriesCount:entries.length});
            if ( err ||  ! entries ||   (entries.length > lib.config.maxLogEntriesPerFile)  ) {
                    return newFile();
             }
             
             console.log({LogFileSize:lib.currentLogFile.uncompressed_size});
             if (lib.currentLogFile.uncompressed_size > lib.config.maxLogSizeBytes) {
                  return newFile();
             }
             
             var msec_per_hour = (1000 * 60 * 60);
             var age_in_hours = (Date.now()-lib.currentLogFile.epoch) / msec_per_hour;
             
             console.log({vs:{LogFileHours:age_in_hours,limit:lib.config.maxLogHoursPerFile}});
             
             if ( age_in_hours >  lib.config.maxLogHoursPerFile ) {
                     return newFile();
             }
            
            lib.extendFile(lib.currentLogFile.fn,logEntry,function(err,fn,nextEntry){
                
                if (err) {
                    console.log({err:err});
                    return newFile();
                }
                
                lib.currentLogFile.entries.push(nextEntry);
                
                if (typeof cb==="function") return cb();   
            });

        });
    }
    
};

lib.init = function(cb){
    // ensure the log storeage path exists
    fs.mkdir(lib.basedir,function(err){
       if (!err) {
           console.log("created "+lib.basedir);
       }   
       var startupEntry = { message : "Logging Has Started" };
       
              
       lib.listLogs(function(list){
           
           if (list.length === 0) {
               lib.currentLogFile = undefined;
           } else {
               lib.currentLogFile  = list[list.length-1];
               lib.createLogListItemGetter(lib.currentLogFile);
               lib.currentLogFile.get(function(entries){
                   lib.currentLogFile.entries=entries;
               });
           }
           
           var compressOldFiles=function() {
               
               if (list.length <= lib.config.maxUncompressedFileCount) {
                   return lib.log(startupEntry,function(){
                       console.log({loggingStarted:startupEntry});
                       if (typeof cb==="function") cb();
                   });
               }
               
                  lib.compressFile(list[0].fn,function(err,e,fn){
                    if (err) {
                        console.log(err);
                        if (typeof cb==="function") cb(err);
                    }
                    console.log("compressed:"+fn);
                    list.splice(0,1);
                    compressOldFiles();
                });
               
               
           };
           console.log({vs:{UncompressedLogFileCOunt:list.length,limit:lib.config.maxUncompressedFileCount}});
      
           compressOldFiles();

           
       });
       
        
    });
};





if (process.mainModule===module) lib.init();