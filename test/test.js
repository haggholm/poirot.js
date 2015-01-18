// jshint mocha:true
'use strict';

var _ = require('lodash')
  , assert = require('assert')
  , jsdom = require('jsdom');


var poirot = require('../lib/poirot')
  , blockParser = require('../lib/block-parser')
  , Template = require('../lib/template');


function stripExtraAttrs(doc) {
  _.forEach(doc.querySelectorAll('[data-poirot]'),
    /**
     * @param {Element} el
     */
    function(el) {
      el.removeAttribute('data-poirot');
      el.removeAttribute('data-poirot-block');
    });
  return doc;
}


describe('Template', function(){
  describe('#render()', function() {
    it('should render simple interpolations', function(){
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
      var tpl = poirot.create(template, {verbose: false})
        , rendered = tpl(ctx);

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

    it('should render block iterations', function(){
      var doc = jsdom.jsdom('<html><head></head><body></body></html>')
        , template = '<ul>{{#data p}}<li>{{ p.foo }}</li>{{/data}}</ul>'
        , ctx = {
          data: [{foo: 'foo1'}, {foo: 'foo2'}]
        };
      Template.setDocument(doc);
      var tpl = poirot.create(template)
        , rendered = tpl(ctx);

      doc.body.innerHTML = rendered.outerHTML;
      assert.equal(
        stripExtraAttrs(doc).body.innerHTML,
        '<div class="poirot-rendered">' +
        '<ul><li>foo1</li><li>foo2</li></ul>' +
        '</div>',
        'Rendered output doesn\'t match'
      );
    });
  });
});


describe('parser', function(){
  describe('#blockify()', function(){
    it('should split blocks', function(){
      var text = '{{#foo}} hum {{#bar baz}}1, 2, 3{{/bar}}{{/foo}}'
        , expected = '<div data-poirot-block="foo"> hum ' +
                     '<div data-poirot-block="bar baz">1, 2, 3' +
                     '</div>' +
                     '</div>';
      assert.equal(blockParser(text), expected);
    });
  });
});
