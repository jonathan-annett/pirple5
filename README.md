# pirple5
Homework Assignment #5

This is an [assignment](assignment.md) for an online course.


**TLDR**

```bash

git clone https://github.com/jonathan-annett/pirple5.git
cd pirple5

# first force testing of test/index.js, and app/lib.js
node test --all

# subsquent tests should only take place if you 
# have edited one of those files

node test
```


**the test framework itself [`test/index/js`](test/index.js)**  

I opted to go somewhat further than the assignment asked, mainly as I wanted to ensure end to end testing of asynchronous functions can be tested in a serial fashion.

It became clear to me when watching the video tutorial that whilst the rudimentary approach demonstrated is fine for small functions that return a value or don't need the results of earlier tests, any serious tests that take some time to complete would be running simultaeously with others in the test queue. 

Intelligent exception trapping in deffered callbacks would not possible either.

If mutiple async functions simultaneously is really what you are trying to test, it would be better to make that a part of the test function itself - by coding a `function test(done){}` which deliberately fires off mutiple async commands and waits for them to complete before calling done.


**the sample [`app/lib.js`](app/test.js)**  

Again, I went far further than a few simple functions. my main motivation here was the realization that in my previous 4 assignments I had not implemented any serious logging mechanism, mainly as the assignment specs had never mandated one. I'd been intending to write a logging module the moment an assignment asked for one. 

As so I decided here to make my **test case** a logging framework, as I figured I'd really need to thorougly test that framework anyway. 

As I worked on both files, they both got better.


