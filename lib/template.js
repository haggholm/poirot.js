// If you’re reading this, you’ll probably find the code pretty ugly. (I kind
// of hope you do.) It’s intended to be performant AND to minify well; some
// clarity has been sacrificed.

/**
 * @module template
 */

/**
 * The standard DOM HTMLElement.
 * @external {HTMLElement}
 * @class
 * @see https://developer.mozilla.org/en/docs/Web/API/HTMLElement
 */

/**
 * The standard DOM document.
 * @external {Document}
 * @class
 * @see https://developer.mozilla.org/en/docs/Web/API/Document
 */

'use strict';


/**
 * @param {string|string[]} html See {@link Template}
 * @param {Array.<object[]>} bindings See {@link Template}
 * @returns {function} A bound instance of {@link Template#render}, which can be
 *   injected by invoking with values accordingly.
 * @alias module:template
 */
var TemplateModule = function(html, bindings) {
  return Template.prototype.render.bind(new Template(html, bindings));
};

var BLOCK_OPEN = '#'
  , BLOCK_CLOSE = '/'
  , FUNCTION = '!'
  , FRAGMENT = 'F'
  , ESCAPED = ''
  , LITERAL = 'L'
  , NUMERAL = 'N';

module.exports = TemplateModule;

/**
 * Template type tags, used by the poirot compiler when generating injection
 * definitions.
 *
 * @property {string} BLOCK_OPEN
 * @property {string} BLOCK_CLOSE
 * @property {string} FUNCTION
 * @property {string} FRAGMENT
 * @property {string} ESCAPED
 * @property {string} LITERAL
 */
module.exports.TYPE = {
  BLOCK_OPEN: BLOCK_OPEN,
  BLOCK_CLOSE: BLOCK_CLOSE,
  FUNCTION: FUNCTION,
  FRAGMENT: FRAGMENT,
  ESCAPED: ESCAPED,
  LITERAL: LITERAL,
  NUMERAL: NUMERAL
};


/**
 * Delegate to document.createElement(). Replace to substitute
 * another element creation method, e.g. to use jsdom in Node.
 *
 * @param {string} nodeName
 * @returns {HTMLElement}
 * @private
 */
var createElement = function(nodeName) {
  // jshint browser: true
  return document.createElement(nodeName);
};

/**
 * Delegate to document.createTextNode(). Replace to substitute
 * another element creation method, e.g. to use jsdom in Node.
 *
 * @param {string} text
 * @returns {Text}
 * @private
 */
var createTextNode = function(text) {
  // jshint browser: true
  return document.createTextNode(text);
};

/**
 * Provide a document, which will be used to create {@link HTMLElement}s. Normally
 * this binds to
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/Window.document window.document}
 * without interference, but to use
 * {@link https://github.com/tmpvar/jsdom jsdom}
 * (in Node, duh), provide the jsdom document instead.
 *
 * @param {Document} doc
 */
TemplateModule.setDocument = function(doc) {
  createElement = doc.createElement.bind(doc);
  createTextNode = doc.createTextNode.bind(doc);
};

var renderFunctions = {};

/**
 * @param {string} code
 * @returns {function}
 */
TemplateModule.getHandler = function(code) {
  return renderFunctions[code];
};

/**
 * @param {string} code
 * @param {function} handler
 * @returns {TemplateModule} Returns the module object for chaining
 */
TemplateModule.registerHandler = function(code, handler) {
  if (renderFunctions[code] !== undefined) {
    throw 'A handler for template code ' + code + ' already exists';
  }
  renderFunctions[code] = handler;
  return this;
};


(function _initHandlers() {
  var registerHandler = TemplateModule.registerHandler;
  registerHandler(FUNCTION, function(target, value, isAttr) {
    if (isAttr) {
      target.value = value;
    } else {
      // This is not intended usage, but let's do SOMETHING, at least.
      renderFunctions[ESCAPED](target, value(), false);
    }
  });

  registerHandler(ESCAPED, function(target, value, isAttr) {
    if (isAttr) {
      target.value = value;
    } else {
      if (target.childNodes.length === 0) {
        target.appendChild(createTextNode(value));
      } else {
        target.firstChild.nodeValue = value;
      }
    }
  });

  registerHandler(LITERAL, function(target, value, isAttr) {
    if (isAttr) {
      target.value = value;
    } else {
      target.innerHTML = value;
    }
  });

  registerHandler(NUMERAL, function(target, value, isAttr) {
    var v = isNaN(value) ? 'NaN' : value;
    if (isAttr) {
      target.value = v;
    } else {
      target.innerHTML = v;
    }
  });

  registerHandler(FRAGMENT, function(target, value, isAttr) {
    var v = isNaN(value) ? 'NaN' : value;
    if (isAttr) {
      target.value = v;
    } else {
      target.innerHTML = v;
    }
  });
})();


/**
 * Poirot runtime template class.
 *
 * Poirot templates are created by the poirot system itself. The parameters are
 * convoluted; fortunately you needn't worry. About the only thing you should
 * need to care about with the template class is the
 * [Template.render()]{@link Template#render} method.
 *
 * @param {Array.<object[]>} bindingDefs
 * @param {string|string[]} template
 * @param {string} [blockExpr=null]
 * @param {HTMLElement} [root=null]
 * @constructor
 */
function Template(bindingDefs, template, blockExpr, root) {
  var self = this;
  /** {Array.<object[]> */
  self.references = bindingDefs;
  /** {string|string[]} */
  self.template = template;

  if (root === undefined && typeof(blockExpr) === 'object') {
    root = blockExpr;
    blockExpr = undefined;
  }

  /**
   * @private
   * @type {string}
   */
  self.blockExpr = blockExpr;

  if (root) {
    self.root = root;
  } else {
    var div = createElement('div');
    div.innerHTML = typeof(template) === 'string' ?
      template : template.join('data-poirot');
    self.root = div.firstChild;
  }

  /**
   * @private
   * @type {object}
   */
  self.bindings = {};
  /**
   * @private
   * @type {Template[]}
   */
  self.children = [];

  self.walk(this.root, bindingDefs.slice(0));
}
TemplateModule.Template = Template;

/**
 * @private
 * @returns {Template}
 */
Template.prototype.clone = function() {
  var self = this;
  return new Template(
    self.references,
    self.template,
    self.root.cloneNode(true));
};
/**
 * @private
 * @returns {Template}
 */
Template.prototype.cloneSub = function() {
  var self = this;
  return new Template(
    self.references,
    self.template,
    self.root.firstChild.cloneNode(true));
};


/**
 * @param {Element} el
 * @param {Array.<object[]>} bindingDefs
 * @private
 */
Template.prototype.walk = function(el, bindingDefs) {
  if (bindingDefs.length === 0 || el.nodeName === '#text') {
    return;
  }

  var self = this, poirot = 'data-poirot';
  if (el.hasAttribute(poirot)) {
    //el.removeAttribute(poirot);
    self.bindNode(el, bindingDefs.shift());
  }

  if (!el.hasAttribute(poirot+'-sub')) {
    var i, childLen = el.childNodes.length;
    for (i = 0; i < childLen; i++) {
      self.walk(el.childNodes[i], bindingDefs);
    }
  }
};


/**
 * @private
 * @param defn
 * @param {HTMLElement} target
 * @returns {Function}
 */
var renderIterSubTemplate = function(defn, target) {
  var arr = defn.blockExpr.split(' ')
    , from = arr[0]
    , as = arr[1];
  return function(values) {
    var k, res, idx
      , values$ = {}
      , src = values[from];
    if (src === undefined) {
      return;
    }
    var srclen = src.length
      , node = target.firstChild
      , next = node ? node.nextSibling : null;
    while (next) {
      target.removeChild(node);
    }

    for (k in values) { // jshint ignore:line
      values$[k] = values[k];
    }
    for (idx = 0; idx < srclen; ++idx) {
      values$[as] = src[idx];
      res = defn.cloneSub().render(values$);
      target.appendChild(res);
    }
  };
};

/**
 * @param {Element} el
 * @param {object[]} defns
 * @private
 */
Template.prototype.bindNode = function(el, defns) {
  var self = this, i, defn;
  for (i = defns.length - 1; i >= 0; --i) {
    defn = defns[i];
    if (defn instanceof Template) {
      self.children.push({
        template: defn,
        render: renderIterSubTemplate(defn, el)
      });

    } else {
      if (!(defn.key in self.bindings)) {
        self.bindings[defn.key] = [];
      }
      this.bindings[defn.key].push(defn);
      defn._target = defn.at === undefined ? el : el.getAttributeNode(defn.at);
      defn._render = renderFunctions[defn.tp];
    }
  }
};


/**
 * @param {Object.<string,*>} values Hash of {name: value} to inject into the
 *                                   template.
 * @returns {HTMLElement} An {@link HTMLElement} with the values injected.
 */
Template.prototype.render = function(values) { // jshint ignore:line
  var self = this, key, i, defn, defns
    , children = self.children
    , bindings = self.bindings;
  for (key in bindings) {      // jshint ignore:line
    var parts = key.split('.')
      , plen = parts.length
      , subv = values;
    for (i = 0; i < plen && subv !== undefined; ++i) {
      subv = subv[parts[i]];
    }
    if (subv !== undefined) {
      defns = bindings[key];
      for (i = defns.length-1; i >= 0; --i) {
        defn = defns[i];
        try {
          defn._render(defn._target, subv, defn.at);
        } catch (e) {
          console.error('Failed to render value:', subv, e);
          console.trace();
        }
      }
    }
  }

  for (i = children.length - 1; i >= 0; --i) {
    children[i].render(values);
  }

  return self.root;
};
