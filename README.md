# pirple5
Homework Assignment #5

This is an [assignment](assignment.md) for an online course.


**TLDR**

```bash

git clone https://github.com/jonathan-annett/pirple5.git
cd pirple5

node test
```


**the test framework itself [`test/index/js`](test/index.js)**  

I opted to go somewhat further than the assignment asked, mainly as I wanted to ensure end to end testing of asynchronous functions can be tested in a serial fashion.

It became clear to me when watching the video tutorial that whilst the rudimentary approach demonstrated is fine for small functions that return a value or don't need the results of earlier tests, any serious tests that take some time to complete would be running simultaeously with others in the test queue. 

Intelligent exception trapping in deffered callbacks would not really be possible either, as any exceptions that take place in a deffered callback might not be trapped properly.

So I opted against a syncrhonous [for - in loop which fires off multiple potentially async tests](https://github.com/pirple/The-NodeJS-Master-Class/blob/728dd393177a215e487de112671a970350d24d50/Section%206/FINAL/test/index.js#L36) in favour of several nested [asynchrous](test/index.js#L585) [loops](test/index.js#L611) which acheives the same thing, but does not start the next test until the previous test has completed.

If mutiple async functions simultaneously are really what you are trying to test, it would be better to make that a part of the test function itself - by coding a `function test(done){}` which deliberately fires off mutiple async commands and waits for them to complete before calling done.


**the sample [`app/lib.js`](app/lib.js)**  

Again, I went far further than a few simple functions. my main motivation here was the realization that in my previous 4 assignments I had not implemented any serious logging mechanism, mainly as the assignment specs had never mandated one. I'd been intending to write a logging module the moment an assignment asked for one. 

As so I decided here to make my **test case** a logging framework, as I figured I'd really need to thorougly test that framework anyway. 

As I worked on both files, they both got better.

**extra miles*

 * [syntax coloring](test/index.js#L120)
 * [test timing](test/index.js#L263)
 * [version hashing](test/index.js#L67) to detect if retesting is needed
 * [configuration in `test/tests.json`](test/tests.json) to [autoload](test/index.js#L652) `tests` ([exported by a module being tested](app/lib.js#L748))
 * [detection of not calling `done()`](test/index.js#L482), and [calling `done()` mutiple times](test/index.js#L545), and exceptions that happen [after `done()` has been called](test/index.js#L511)
 * a temporary [global exception hook](test/index.js#L523) is [installed](test/index.js#L529) and [removed](test/index.js#L525) at [appropriate](test/index.js#L552) [places](test/index.js#L561)
