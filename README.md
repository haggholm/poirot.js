# poirot

[![Greenkeeper badge](https://badges.greenkeeper.io/haggholm/poirot.js.svg)](https://greenkeeper.io/)

poirot: Small, but quick and clever mustache.

The chief motivation behind these templates is to provide an efficient way
to inject handlers into templates, making it easy to use templates for
webapps. In order to make this possible, Poirot does not render templates
into HTML *strings*, but instead to DOM nodes.

As a pleasant side effect, initial results suggest that at least for simple
use cases, it’s extremely fast once compiled. Time will tell whether this holds 
as the library grows toward a more useful feature set.
(See [jsPerf](http://jsperf.com/poirot-templates).) The compilation process
itself is slow compared to, say, Handlebars. Poirot is primarily intended
for precompilation, and compilation speed is not a major goal.

**WARNING:** Right now, this is *extremely* early in development. Neither
the feature set nor the template syntax has been nailed down.


## LICENSE

(MIT License)

Copyright (c) 2015 Petter Häggholm <petter@petterhaggholm.net>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
