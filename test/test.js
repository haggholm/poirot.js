// jshint mocha:true
'use strict';

var _ = require('lodash')
  , assert = require('assert')
  , jsdom = require('jsdom');


var poirot = require('../lib/poirot')
  , parser = require('../lib/parse')
  , Template = require('../lib/poirot-template');


function stripExtraAttrs(doc) {
  _.forEach(doc.querySelectorAll(Template.ID_SELECTOR),
    /**
     * @param {Element} el
     */
    function(el) {
      el.removeAttribute(Template.DOM_NODE_ID);
    });
  return doc;
}


describe('Template', function(){
  describe('#render()', function() {
    it('should do stuff', function(){
      var doc = jsdom.jsdom('<html><head></head><body></body></html>')
        , template = '<div><p>{{ foo }} and ' +
                     '<span class="{{baz}}">{{bar}}</span>' +
                     '</p></div>'
        , ctx = {
          foo: 'Foo!',
          bar: 'Bar!',
          baz: 'baz-cls'
        };
      Template.setDocument(doc);
      var tpl = poirot.create(template, {verbose: true})
        , rendered;

      rendered = tpl(ctx);

      doc.body.innerHTML = rendered.outerHTML;
      assert.equal(
        stripExtraAttrs(doc).body.innerHTML,
        '<div class="poirot-rendered">' +
        '<div><p><span>Foo!</span> and ' +
        '<span class="baz-cls">Bar!</span>' +
        '</p></div>' +
        '</div>',
        'Rendered output doesn\'t match'
      );
    });
  });
});


describe('parser', function(){
  describe('#blockify()', function(){
    var text = '{{#foo}} hum {{#bar}}1, 2, 3{{/bar}}{{/foo}}'
      , expected = '<div data-poirot-block="foo"> hum ' +
                   '<div data-poirot-block="bar">1, 2, 3' +
                   '</div>' +
                   '</div>';
    assert.equal(parser.blockify(text), expected);
  });
});
