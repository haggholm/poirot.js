# poirotjs.

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
