/*
Copyright 2019 Jonathan Annett
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/*

this is a log file manager.

*/

"use strict";
/* explode-require the node-libs we need */
var _needed =
    "fs,path,zlib,assert";
var [fs,path,zlib,assert] = _needed.split(",").map(require);

/* lib is exported */
var lib = module.exports = {};

lib.config = {
    maxLogSizeBytes            : 1024*1024,
    maxLogEntriesPerFile       : 1000,
    maxLogHoursPerFile         : 5,
    maxUncompressedFileCount   : 25,
    max_file_cache             : 10,
};

lib.basedir = path.join(__dirname,'..','.logs');

var conColor={colors:true,depth:null}
console.dump = function (obj) {
   console.dir (obj,conColor);
}


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

//sort method to pass into array.sort() for an array with element.epoch for each element
lib.epoch_sort_recent_first = function(a,b){
    var A = a.t || a.epoch;
    var B = b.t || b.epoch;
    if (A > B) return -1;
    if (A < B) return 1;
    return 0;
};

//sort method to pass into array.sort() for an array with element.epoch for each element
lib.epoch_sort_recent_last = function(a,b){
    var A = a.t || a.epoch;
    var B = b.t || b.epoch;
    if (A > B) return 1;
    if (A < B) return -1;
    return 0;
};

// lib.createLogListItemGetter() adds a .get method to item 
// the method that gets added: item.get(cb) --> cb(err,[...],epoch)
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

// lib.createLogListItem(opt,fn) --> object to place in the list returned by lib.listLogs()
// does not create any files, just wraps filename in object
lib.createLogListItem = function (opt,fn) {

   var result = null;
   
   switch (typeof opt) {
       case 'string' :
         fn  = opt;
         opt = {};
         break;
       case 'undefined' : 
         opt = {};  
   }
   
   var epoch = lib.logFileEpoch(fn);
   var compressed = fn.indexOf(".json.gz")>0;
   var needed = false;
   if (opt.all) {
       needed = epoch ? true : false;
   } else {
       if (epoch) {
           if (opt.compressed===true && compressed===true) needed = true;
           if (opt.compressed===false && compressed===false) needed = true;
           if (opt.compressed===undefined && compressed===false) needed = true;
       }
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
           fn : path.join(lib.basedir,path.basename(fn))
       };

       if ( opt.getter ) {
           lib.createLogListItemGetter(result);
       }

   }
   return result;

};

//lib.listLogs(opt,cb) --> cb([file1,file2]) 
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
        files = files.sort(lib.epoch_sort_recent_first);
        
        cb(files);
    });
};


// create a new log file, with an object for the first entry
//lib.createFile (firstEntry,cb) ---> cb(err,fn,firstEntry) .... fn is the filename for future writes
lib.createFile = function (firstEntry,cb,when){
    when = when || Date.now();
    if (typeof firstEntry==='function') {
        cb=firstEntry;
        firstEntry = undefined;
    }
    
    
    var fn = lib.logFileName(when);
    if (fn===false) throw new Error("Unknown error establishing log filename");
    
    if (typeof firstEntry !== 'object' || firstEntry===null) {
        firstEntry = {"info":"log file created",fn:fn};
    }

    var file_string = JSON.stringify([{t:when,e:firstEntry}]);
    
    fs.writeFile(fn,file_string,function(err){
        if (err) {
          return typeof cb === 'function' ?  cb(err) : undefined;  
        }   
        if (typeof cb === 'function' ) cb(false,fn,firstEntry);
    });
    return fn;
};

//lib.extendFile(f,nextEntry,cb) --> cb(false,fn,nextEntry)
lib.extendFile = function (f,nextEntry,cb,when){
    when = when || Date.now();
    var fn = lib.logFileName(f);
    if (fn===false) return typeof cb === 'function' ?   cb(new Error("invalid log filename")) : undefined;
    if (typeof nextEntry!=='object') {
        typeof cb === 'function' ?  cb(new Error("invalid log Entry")) : undefined;       
    }
    
    // make a buffer we will use to extend the file, which omits the opening [
    var buffer = new Buffer(",\n"+(JSON.stringify([{t:when,e:nextEntry}]).substr(1)));
    
    fs.stat(fn,function(err,stats){
        if (err||!stats) return typeof cb === 'function' ? cb(err) : err;
        fs.open(fn,'r+',function(err,fd){
            if (err||!fd) return typeof cb === 'function' ? cb(err) : err;
            fs.write(fd,buffer,/*buffer offset*/0,buffer.length,/*file offset*/stats.size-1,function(errWrite){
                fs.close(fd,function(errClose){
                   if (errWrite) {
                       return cb(errWrite);
                   }
                   if (errClose) {
                       return cb(errClose);
                   }
                   
                   return typeof cb === 'function' ? cb(false,fn,nextEntry) : undefined;
               }); 
            });
        });
    });
    
};
//lib.arrayExtendFile (f,nextEntries,cb) --> cb (false,fn,nextEntries);
lib.arrayExtendFile = function (f,nextEntries,cb,when){
    when = when || Date.now();
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
                             
                             return fs.unlink(before_fn,function(err){
                                
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
                 setTimeout(function(){
                     fs.stat(after_fn,function(err_after,stat_after){
                         if (!err_after && stat_after && stat_after.mtime) {
                             return fs.unlink(before_fn,function(err){
                             
                                 if (err) return cb(err);
                                 return cb (false,epoch,after_fn,stat_after.mtime.getTime());
                             
                             });
                         }
                         return cb(err_after);
                     });
                 },100);
                 
            });

       });
   });      
   
};

lib.all_epochs=[];
lib.getEntriesCache={};
lib.getEntriesCache_=[];
//lib.getEntries(epoch,cb) --> cb(false,entries)
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
//lib.getEntries(epoch,cb) --> cb(false,entries)
lib.getAllEntries = function (reverse,cb) {
    if (typeof reverse==='function') {
        cb = reverse;
        reverse = false;
    }
    
    if (typeof cb==='function') {
        
        lib.listLogs ({all:true},function(logs){
            
            var loop = function (i) {
                
                if (i > logs.length-1) {
                    
                    return cb(true);
                    
                } else {
                    
                    lib.getEntries(logs[i].epoch,function(err,entries){
                        
                        if (err) return cb(err);
                        
                        cb(false, entries.sort(lib.epoch_sort_recent_last) );
                        
                        loop(++i);
                        
                    });
                }
            };
            
            var reverse_loop = function (i) {
               if (i<0) {
                   return cb(true);
               } else {
                   
                   lib.getEntries(logs[i].epoch,function(err,entries){
                       
                       if (err) return cb(err);
                       
                       cb(false, entries.sort(lib.epoch_sort_recent_first) );
                       
                       reverse_loop(--i);
                       
                   });
                   
               }
           };

            if (reverse) {
                reverse_loop(0);
            } else {
                loop(logs.length-1);
            }
            
        });
        
    }
   
};


// lib.getMostRecentLogEntries will return all entries of the current log file
lib.getMostRecentLogEntries = function ( cb  ) {
    var result = lib.currentLogFile ? lib.currentLogFile.entries || []  : [];
    return (typeof cb ==='function') ? cb(result) : result ;
};
// getLogPreviousEntries will return the previous file of log entries
lib.getLogPreviousEntries = function ( entries, cb  ) {
    
    var current_epoch = (typeof entries === 'object'  ? entries[0].t : 
                            (typeof entries === 'number' ) ? entries : false
                        );
                        
    if (current_epoch) {
            
 
        // lookup the log file epoch in the master index
        var ix = lib.all_epochs.indexOf(current_epoch);
        if (ix>0) {
            // we aren't on the first one, so pick the previous
            ix --;
        } else {
            // either on the first one, or the entries aren't in the master index - fail.
            if (typeof cb ==='function') {
                cb(new Error("no previous entries"));
            }
            return; 
        }
   
        return lib.getEntries(lib.all_epochs[ix],cb);
        
    }
    if (typeof cb ==='function') {
        cb(new Error("invalid entries array passed into getLogPreviousEntries()"));
    }
};

lib.getLogNextEntries = function ( entries, cb  ) {
    
    var current_epoch = (typeof entries === 'object'  ? entries[0].t : 
                            (typeof entries === 'number' ) ? entries : false
                        );
                        
    if (current_epoch) {

          
        // lookup the log file epoch in the master index
        var ix = lib.all_epochs.indexOf(current_epoch);
        if ((ix >=0) && (ix<lib.all_epochs.length-1)) {
            // we aren't on the last one, so pick the next
            ix ++;
        } else {
            // either on the last one, or the entries aren't in the master index - fail.
            if (typeof cb ==='function') {
                cb(new Error("no next entries"));
            }
            return; 
        }
        
        return lib.getEntries(lib.all_epochs[ix],cb);
     
    }
    if (typeof cb ==='function') {
        cb(new Error("invalid entries array passed into getLogPreviousEntries()"));
    }
};

lib.currentLogFile = false;

//lib.log  ( logEntry, cb )  --> cb(false,fn,nextEntry);
lib.log = function ( logEntry, cb , catchup ) { 
    
    if (typeof logEntry === 'function') {
        cb = logEntry;
        logEntry = undefined;
    }
    var xxx = {when:Date.now(),logEntry:logEntry}
    lib.log.queue.push(xxx);
    console.dump(xxx);
    
    if (typeof cb!=='function' || lib.log.busy) {
        
        // there is no callback, or we are still waiting for other items to finish writing
        // so we can't continue. that's ok as the next call (or the one that's busy) will deal with it.
        
        return;
     }
     
    lib.log.busy = true;

    function writeLog(logItem,cb){
        
        var {when,logEntry} = logItem;
        
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
                
                lib.currentLogFile  = lib.createLogListItem({getter:true},fn);
                lib.all_epochs.push(lib.currentLogFile.epoch);
                if (typeof logEntry === 'object') {
        
                    lib.extendFile (fn,logEntry,function(err,fn,nextEntry){
                        
                        if (err) {
                            return console.log({err:err});
                        }
                        lib.currentLogFile.entries = [nextEntry];
                        cb(false,fn,nextEntry);  
                    });
                
                } else {
                    lib.currentLogFile.entries = [];
                    cb(false,fn);   
                    
                }
            },when);
        };
        
        if (typeof lib.currentLogFile === 'undefined') {
            return newFile();
        }
        
        
        if (typeof lib.currentLogFile.get === 'function') {
            return lib.currentLogFile.get(function(err,entries){
                
               
                if ( err ||  ! entries ||   (entries.length > lib.config.maxLogEntriesPerFile)  ) {
                        return newFile();
                 }
                 
                 if (lib.currentLogFile.uncompressed_size > lib.config.maxLogSizeBytes) {
                      return newFile();
                 }
                 
                 var msec_per_hour = (1000 * 60 * 60);
                 var age_in_hours = (when-lib.currentLogFile.epoch) / msec_per_hour;
                 
                 if ( age_in_hours >  lib.config.maxLogHoursPerFile ) {
                         return newFile();
                 }
                if (typeof logEntry === 'object') {
                    lib.extendFile(lib.currentLogFile.fn,logEntry,function(err,fn,nextEntry){
                        
                        if (err) {
                            console.log({err:err});
                            return newFile();
                        }
                        
                        lib.currentLogFile.entries.push(nextEntry);
                        
                        return cb(false,fn,nextEntry);   
                    },when);
                } else {
                    return cb(false,lib.currentLogFile.fn);   
                }
    
            });
        } else {
            return cb(new Error("can't get data from log entry"));   
        }
    }
    
    // loop to deal with pending log entries
    var loggerLoop = function () {
        if (lib.log.queue.length===0) {
            // Past the end of the list - break out of loop
            lib.log.busy = false;
            /*function to call-->*/cb(false,lib.currentLogFile.fn,logEntry);/*<--to exit*/
        } else {
            writeLog(lib.log.queue.shift(),function(err,fn,entry){
                if (err) return cb(err);
                // logging is not that critical, so don't loop frantically here unless there are a lot of messages
                var delayTime;// 2 per second = 0.5 to 1
                /*switch (true) {
                    case lib.log.queue.length >= 100  : delayTime=10; break;  // 100 per second = 1 second lag
                    case lib.log.queue.length >= 50   : delayTime=20; break;  // 50 per second  = 1 to 2.45 second lag
                    case lib.log.queue.length >= 20   : delayTime=50; break;  // 20 per second  = 1 to 1.9 second lag
                    case lib.log.queue.length >= 10   : delayTime=100; break; // 10 per second  = 1 to 1.9 second lag
                    case lib.log.queue.length >= 5    : delayTime=200; break; // 5 per second   = 1 to 1.8 second lag
                    default:
                    delayTime=500;// 2 per second = 0.5 to 2 seconds lag
                }*/
                delayTime=1;
                setTimeout(loggerLoop,delayTime);
            });
        }
    };
    loggerLoop(0);

    
};
lib.log.queue = [];
lib.log.busy=false;

lib.init = function(cb){
    // ensure the log storeage path exists
    fs.mkdir(lib.basedir,function(err){
       if (!err) {
           console.log("created "+lib.basedir);
       }   
       var startupEntry = { message : "Logging Has Started" };
       
       // get list of logs (most recent will be at 0)       
       lib.listLogs(function(list){
           
           if (list.length === 0) {
               lib.currentLogFile = undefined;
           } else {
               
               //trash any existing epoch master index
               if (lib.all_epochs) {
                  if (lib.all_epochs.length>0) lib.all_epochs.splice(0,lib.all_epochs.length);
               } else {
                  lib.all_epochs = [];
               }
               
               // collect all the log file epochs, with most recent last (hence unshift)
               list.forEach(function(entry,ix){
                   lib.all_epochs.unshift(entry.epoch);
               });
               
               // assign most recently used log file as the current log file
               lib.currentLogFile  = list[0];
               lib.createLogListItemGetter(lib.currentLogFile);
               
               lib.currentLogFile.get(function(err,entries){
                   if (err) return typeof cb==="function" ? cb(err) : undefined;
                   lib.currentLogFile.entries=entries;
               });
           }
           
           var compressOldFiles=function() {
               
               if (list.length <= lib.config.maxUncompressedFileCount) {
                   return lib.log(startupEntry,function(){

                       if (typeof cb==="function") cb(false);
                   });
               }
               
                  lib.compressFile(list[0].fn,function(err,e,fn){
                    if (err) {
                        console.log(err);
                        if (typeof cb==="function") cb(err);
                    }
                    list.splice(0,1);
                    compressOldFiles();
                });
               
               
           };

           compressOldFiles();

           
       });
       
        
    });
};

lib.tests = {

    "lib.init() does not throw" : 
    function (done) {
        assert.doesNotThrow(function(){
            lib.init(function (err){
                assert.equal(err,false);
                done();
            });
        },TypeError);    
    },
    
    "lib.basedir created ok after lib.init()" : 
    function (done) {
        var stat = fs.statSync(lib.basedir);
        assert.ok(stat && stat.isDirectory());
        done();
    },  
    
    
    "lib.logFileName(1223) returns a string": 
    function (done) {
        var value = lib.logFileName(1223);
        assert.equal(typeof value,"string");
        done();
    },  
    
    
    "lib.logFileName(new Date()) returns a string": 
    function (done) {
        var value = lib.logFileName(new Date());
        assert.equal(typeof value,"string");
        done();
    },
    
    
    
    "lib.logFileName(previousFilename) returns same filename": 
    function (done) {
        var previousFilename = lib.logFileName(new Date());
        var value = lib.logFileName(previousFilename);
        assert.equal(value,previousFilename);
        done();
    },
    
    "lib.logFileName(new Date()) returns a filename under basedir": 
    function (done) {
        var value = lib.logFileName(new Date());
        assert.equal(path.dirname(value),lib.basedir);
        done();
    },
    
    "lib.logFileName(new Date()) returns a .json filename": 
    function (done) {
        var value = lib.logFileName(new Date());
        assert.equal(path.extname(value),".json");
        done();
    },
    
    "lib.logFileEpoch(1223) returns a number": 
    function (done) {
        var value = lib.logFileEpoch(1223);
        assert.equal(typeof value,"number");
        done();
    },  
    
    "lib.logFileEpoch(1223) returns 1223": 
    function (done) {
        var value = lib.logFileEpoch(1223);
        assert.equal(value,1223);
        done();
    }, 
    
    "lib.logFileEpoch(new Date()) returns a number": 
    function (done) {
        var value = lib.logFileEpoch(new Date());
        assert.equal(typeof value,"number");
        done();
    },  
    
    
    "lib.logFileEpoch(aDate) returns aDate.getTime()": 
    function (done) {
        var aDate = new Date();
        var value = lib.logFileEpoch(aDate);
        assert.equal(value,aDate.getTime());
        done();
    }, 
    
    "lib.logFileEpoch(aDate.getTime()) returns aDate.getTime()": 
    function (done) {
        var aDate = new Date();
        var value = lib.logFileEpoch(aDate.getTime());
        assert.equal(value,aDate.getTime());
        done();
    },  
    
    
    "lib.logFileEpoch(previousFilename) returns a number": 
    function (done) {
        var previousFilename = lib.logFileName(new Date());
        var value = lib.logFileEpoch(previousFilename);
        assert.equal(typeof value,"number");
        done();
    },
    
    
    "lib.logFileEpoch(previousFilename) returns epoch of previousFilename": 
    function (done) {
        var epoch = Date.now();
        var previousFilename = lib.logFileName(epoch);
        var value = lib.logFileEpoch(previousFilename);
        assert.equal(value,epoch);
        done();
    },
    
    
    "lib.compressedL`ogFileName(1223) returns a string": 
    function (done) {
        var value = lib.compressedLogFileName(1223);
        assert.equal(typeof value,"string");
        done();
    },  
    
    
    "lib.compressedLogFileName(new Date()) returns a string": 
    function (done) {
        var value = lib.compressedLogFileName(new Date());
        assert.equal(typeof value,"string");
        done();
    },
    
    
    
    "lib.compressedLogFileName(previousFilename) returns same filename": 
    function (done) {
        var previousFilename = lib.compressedLogFileName(new Date());
        var value = lib.compressedLogFileName(previousFilename);
        assert.equal(value,previousFilename);
        done();
    },
    
    "lib.compressedLogFileName(new Date()) returns a filename under basedir": 
    function (done) {
        var value = lib.compressedLogFileName(new Date());
        assert.equal(path.dirname(value),lib.basedir);
        done();
    },
    
    "lib.compressedLogFileName(new Date()) returns a .json.gz filename": 
    function (done) {
        var value = lib.compressedLogFileName(new Date());
        var suffix = ".json.gz";
        assert.equal(value.substr(0-suffix.length),suffix);
        done();
    },

    "lib.epoch_sort_recent_first works as expected" : 
    function (done) {
        var to_element = function(x){return {epoch:x}};
        var input = [ 1,3,8,2,1024,7].map(to_element);
        var expected =  [1024,8,7, 3, 2,1].map(to_element);
        var expected_JSON = JSON.stringify(expected);
        var value = JSON.stringify(input.sort(lib.epoch_sort_recent_first));
        assert.equal(value,expected_JSON);
        done();
    },
    
    "lib.epoch_sort_recent_last works as expected" : 
    function (done) {
        var to_element = function(x){return {epoch:x}};
        var input = [ 1,3,8,2,1024,7].map(to_element);
        var expected =  [1,2,3,7,8,1024 ].map(to_element); 
        var expected_JSON = JSON.stringify(expected);
        var value = JSON.stringify(input.sort(lib.epoch_sort_recent_last));
        assert.equal(value,expected_JSON);
        done();
    },
    
    "lib.createLogListItem(fn) does not throw" : 
    function (done) {
       assert.doesNotThrow(function(){
            var fn = lib.logFileName(Date.now());
            lib.createLogListItem (fn);
            done();
       },TypeError);    
    },
    
    "lib.createLogListItem({},fn) creates an object" : 
    function (done) {
        var fn = lib.logFileName(Date.now());
        var value = lib.createLogListItem ({},fn);
        assert.equal(typeof value,'object');
        assert.notEqual(value,null);
        done();
    },
    
    "lib.createLogListItem({},fn_gz) does not create an object" : 
    function (done) {
        var fn_gz = lib.compressedLogFileName(Date.now());
        var value = lib.createLogListItem ({},fn_gz);
        assert.equal(typeof value,'object');
        assert.equal(value,null);
        done();
    },
    
    "lib.createLogListItem({compressed:true},fn_gz) creates an object" : 
    function (done) {
        var fn_gz = lib.compressedLogFileName(Date.now());
        var value = lib.createLogListItem ({compressed:true},fn_gz);
        assert.equal(typeof value,'object');
        assert.notEqual(value,null);
        done();
    },
    
    "lib.createLogListItem({compressed:true},fn) does not create an object" : 
    function (done) {
        var fn = lib.logFileName(Date.now());
        var value = lib.createLogListItem ({compressed:true},fn);
        assert.equal(typeof value,'object');
        assert.equal(value,null);
        done();
    },
    
    "lib.createLogListItem({all:true},fn_gz) creates an object" : 
    function (done) {
        var fn_gz = lib.compressedLogFileName(Date.now());
        var value = lib.createLogListItem ({all:true},fn_gz);
        assert.equal(typeof value,'object');
        assert.notEqual(value,null);
        done();
    },
    
    
    "lib.createLogListItem({},fn) creates an object without .get() method" : 
    function (done) {
        var fn = lib.logFileName(Date.now());
        var value = lib.createLogListItem ({},fn);
        assert.equal(typeof value,'object');
        assert.notEqual(value,null);
        assert.equal(typeof value.get,'undefined');
        done();
    },
    
    "lib.createLogListItem({getter:true},fn) creates an object with .get() method" : 
    function (done) {
        var fn = lib.logFileName(Date.now());
        var value = lib.createLogListItem ({getter:true},fn);
        assert.equal(typeof value,'object');
        assert.notEqual(value,null);
        assert.equal(typeof value.get,'function');
        done();
    },
    
    "lib.createLogListItem({all:true,getter:true},fn) creates an object with .get() method" : 
    function (done) {
        var fn = lib.logFileName(Date.now());
        var value = lib.createLogListItem ({all:true,getter:true},fn);
        assert.equal(typeof value,'object');
        assert.notEqual(value,null);
        assert.equal(typeof value.get,'function');
        done();
    },
    
    "lib.createLogListItem({compressed:true,getter:true},fn_gz) creates an object with .get() method" : 
    function (done) {
        var fn_gz = lib.compressedLogFileName(Date.now());
        var value = lib.createLogListItem ({compressed:true,getter:true},fn_gz);
        assert.equal(typeof value,'object');
        assert.notEqual(value,null);
        assert.equal(typeof value.get,'function');
        done();
    },
    
    "lib.createLogListItem({all:true,getter:true},fn_gz) creates an object with .get() method" : 
    function (done) {
        var fn_gz = lib.compressedLogFileName(Date.now());
        var value = lib.createLogListItem ({all:true,getter:true},fn_gz);
        assert.equal(typeof value,'object');
        assert.notEqual(value,null);
        assert.equal(typeof value.get,'function');
        done();
    },
    
    "lib.listLogs({},cb) returns an array" : 
    function (done) {
        lib.listLogs({},function(files){
            assert.equal(typeof files,"object");
            assert.equal(files.constructor,Array);
        });
        done();
    },
    
    
    "lib.listLogs({},cb) returns an array of valid log file objects" : 
    function (done) {
        lib.listLogs({},function(files){
            files.forEach(function(file){
                assert.equal(typeof file,"object");
                assert.equal(typeof file.epoch,'number');
                assert.equal(typeof file.fn,'string');
                assert.equal(typeof fs.statSync(file.fn),'object');
                var fileData = fs.readFileSync(file.fn);
                assert.equal(typeof fileData,'object');
                var fileJSON = JSON.parse(fileData);
                assert.equal(typeof fileJSON,'object');
                assert.equal(fileJSON.constructor,Array);
            });
            
            done();
        });
        
    },
    
    "lib.createFile(firstEntry,cb) calls cb with a string filename that points to valid JSON file":
    function (done) {
          var firstEntry = {hello:"world"};
          var JS = JSON.stringify(firstEntry);
          lib.createFile(firstEntry,function(err,fn,entry){
              assert.equal(err,false);
              assert.equal(typeof fn,'string');
              assert.equal(typeof entry,'object');
              assert.equal(JSON.stringify(entry),JS);
              assert.equal(typeof fs.statSync(fn),'object');
              var data = JSON.parse(fs.readFileSync(fn));
              assert.equal(typeof data,'object');
              assert.equal(JSON.stringify(data[0].e),JS);
              done();
          });
    },
    
    
    "lib.createFile(cb) calls cb with a string filename that points to valid JSON file": 
    function (done) {
          lib.createFile(function(err,fn,entry){
              assert.equal(err,false);
              assert.equal(typeof fn,'string');
              assert.equal(typeof entry,'object');
              assert.equal(typeof fs.statSync(fn),'object');
              var data = JSON.parse(fs.readFileSync(fn));
              assert.equal(typeof data,'object');
              assert.equal(typeof data[0].e,'object');
              done();
          });
    },
    
    "lib.createFile(undefined,cb) calls cb with a string filename that points to valid JSON file": 
    function (done) {
          lib.createFile(undefined,function(err,fn,entry){
              assert.equal(err,false);
              assert.equal(typeof fn,'string');
              assert.equal(typeof entry,'object');
              assert.equal(typeof fs.statSync(fn),'object');
              var data = JSON.parse(fs.readFileSync(fn));
              assert.equal(typeof data,'object');
              assert.equal(typeof data[0].e,'object');
              done();
          });
    },
    
    "lib.createFile(null,cb) calls cb with a string filename that points to valid JSON file": 
    function (done) {
          lib.createFile(null,function(err,fn,entry){
              assert.equal(err,false);
              assert.equal(typeof fn,'string');
              assert.equal(typeof entry,'object');
              assert.equal(typeof fs.statSync(fn),'object');
              var data = JSON.parse(fs.readFileSync(fn));
              assert.equal(typeof data,'object');
              assert.equal(typeof data[0].e,'object');
              done();
          });
    },
    
    "lib.createFile(firstEntry) does not throw":
    function (done) {
          var firstEntry = {hello:"world"};
          assert.doesNotThrow(function() {
               lib.createFile(firstEntry);
               done();
          });
    },
    
    
    "lib.createFile(firstEntry) returns a string filename that points to valid JSON file": 
    function (done) {
          var firstEntry = {hello:"world"};
          var JS = JSON.stringify(firstEntry);
          
          var fn = lib.createFile(firstEntry);
          
          setTimeout(function(){
              assert.equal(typeof fn,'string');
              assert.equal(typeof fs.statSync(fn),'object');
              var data = JSON.parse(fs.readFileSync(fn));
              assert.equal(typeof data,'object');
              assert.equal(JSON.stringify(data[0].e),JS);
              done();
          },1000);
    },
    
    
    
    "lib.createFile() does not throw":
    function (done) {
           assert.doesNotThrow(function() {
               lib.createFile();
               done();
          });
    },
    
    
    "lib.createFile() returns a string filename that points to valid JSON file": 
    function (done) {
          
          var fn = lib.createFile();
          assert.equal(typeof fn,'string');
              
          setTimeout(function(){
              assert.equal(typeof fs.statSync(fn),'object');
              var data = JSON.parse(fs.readFileSync(fn));
              assert.equal(typeof data,'object');
              assert.equal(typeof data[0].e,'object');
              done();
          },1000);
    },
    
    "lib.extendFile(f,nextEntry,cb) calls cb with a valid filename pointing to valid JSON file that contains nextEntry ": 
    function (done) {
        
        var nextEntry =  {random : Math.random()};
        var JS = JSON.stringify(nextEntry);
        lib.createFile(function(err,f){
             assert.equal(err,false);
             lib.extendFile(f,nextEntry,function(err,fn,entry){
                assert.equal(err,false);
                assert.equal(typeof fn,'string');
                assert.equal(typeof entry,'object');
                assert.equal(JSON.stringify(entry),JS);
                assert.equal(typeof fs.statSync(fn),'object');
                var data = JSON.parse(fs.readFileSync(fn));
                assert.equal(typeof data,'object');
                assert.equal(JSON.stringify(data.pop().e),JS);
                done();
            });
        });
    },
    
    "lib.extendFile(f,nextEntry) does not throw ": 
    function (done) {
        
        var nextEntry =  {random : Math.random()};
        lib.createFile(function(err,f){
            assert.equal(err,false);
            assert.doesNotThrow(function(){
                lib.extendFile(f,nextEntry);
                done();
            });
            
        });
        
    },
    
    "lib.arrayExtendFile(f,nextEntries,cb) calls cb with valid filename pointing to valid JSON file": 
    function (done) {
        
        var count = 2 + Math.floor(Math.random()* 5);
        var nextEntries =  [];
        for (var i = 0; i < count ; i ++ ) {
            nextEntries.push({random:Math.random(),i:i,c:count});
        }
        
        var JSs = nextEntries.map(function(nextEntry){return JSON.stringify(nextEntry)});
        lib.createFile(function(err,f){
            assert.equal(err,false);
            lib.arrayExtendFile(f,nextEntries,function(err,fn,entries){
                assert.equal(err,false);
                assert.equal(typeof fn,'string');
                assert.equal(typeof entries,'object');
                assert.equal(entries.length,count);
                JSs.forEach(function(JS,ix) {
                   assert.equal(JSON.stringify(entries[ix]),JS);   
                });
                
                assert.equal(typeof fs.statSync(fn),'object');
                var data = JSON.parse(fs.readFileSync(fn));
                assert.equal(typeof data,'object');
                
                var ix2=(data.length-count);
                var timestamp = data[ix2].t;
                JSs.forEach(function(JS) {
                   assert.equal(JSON.stringify(data[ix2].e),JS);  
                   assert.equal(data[ix2++].t,timestamp);  
                });
                done();
            });
            
        });
        
         
    },
    
    "lib.getAllEntries(cb) returns messages in timestamp order"  : 
    function (done) {
         
            var count = 0;
       
            lib.getAllEntries(function(err,entries){
                
                if (err===true) {
                    return  done();
                }
                
                assert.equal(err,false);
                assert.equal(typeof entries,"object");
                
                var prev=entries[0].t;
                entries.forEach(function(el) {
                    assert.equal(typeof el,"object");
                    assert.equal(typeof el.t,"number");
                    assert.equal(typeof el.e,"object");
                    assert.equal(Object.keys(el).length,2);
                    assert.ok( el.t>=prev );
                    prev=el.t;
                });
                
                count ++;
                
            });
    },
     
    "lib.getAllEntries(false,cb) returns messages in timestamp order"  : 
    function (done) {
         
            var count = 0;
             lib.getAllEntries(false,function(err,entries){
                 
                 if (err===true) {
                     return  done();
                 }
                 
                 assert.equal(err,false);
                 assert.equal(typeof entries,"object");
                 
                 var prev=entries[0].t;
                 entries.forEach(function(el) {
                     assert.equal(typeof el,"object");
                     assert.equal(typeof el.t,"number");
                     assert.equal(typeof el.e,"object");
                     assert.equal(Object.keys(el).length,2);
                     assert.ok( el.t>=prev );
                     prev=el.t;
                 });
                 
                 count ++;
                 
             });
    },
    
    "lib.getAllEntries(true,cb) returns messages in reverse timestamp order"  : 
    function (done) {
         
            var count = 0;
            
            lib.getAllEntries(true,function(err,entries){
                   
                   if (err===true) {
                       return  done();
                   }
                   
                   assert.equal(err,false);
                   assert.equal(typeof entries,"object");
                   
                   var prev=entries[0].t;
                   entries.forEach(function(el) {
                       assert.equal(typeof el,"object");
                       assert.equal(typeof el.t,"number");
                       assert.equal(typeof el.e,"object");
                       assert.equal(Object.keys(el).length,2);
                       assert.ok( el.t<=prev );
                       prev=el.t;
                   });
                   
                   count ++;
                   
               });
    },
    
    
    "lib.log({message:'hello'}) does not throw":
    function(done) {
        assert.doesNotThrow(function(){
            lib.log({message:'hello'});
            done();
        });
    },
    
    "lib.log({message:'hello'},cb) calls cb correctly":
    function(done) {
        lib.log({message:'hello'},function(err,fn,nextEntry){
            assert.equal(err,false);
            assert.equal(typeof fn,'string');
            assert.equal(typeof fs.statSync(fn),'object');
            assert.equal(typeof JSON.parse(fs.readFileSync(fn)),'object'); 
            done();
        });
    },
    
 

    
};


if (process.mainModule===module) lib.init();