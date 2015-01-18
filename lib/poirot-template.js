'use strict';



/**
 * @param {string} html
 * @param {object} bindings
 * @returns {function(this:Template)}
 * @constructor
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

TemplateModule.TYPE = {
  BLOCK_OPEN: BLOCK_OPEN,
  BLOCK_CLOSE: BLOCK_CLOSE,
  FUNCTION: FUNCTION,
  FRAGMENT: FRAGMENT,
  ESCAPED: ESCAPED,
  LITERAL: LITERAL,
  NUMERAL: NUMERAL
};
module.exports = TemplateModule;


/**
 * Delegate to document.createElement(). Replace to substitute
 * another element creation method, e.g. to use jsdom in Node.
 *
 * @param {string} nodeName
 * @returns {HTMLElement}
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
 */
var createTextNode = function(text) {
  // jshint browser: true
  return document.createTextNode(text);
};

/**
 * Provide a document, which will be used to create HTMLElements. Normally
 * this binds to window.document without interference, but to use jsdom
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
 * @param {object[][]} bindingDefs
 * @param {string} template
 * @param {string} [blockExpr=null]
 * @param {HTMLElement} [root=null]
 * @constructor
 */
function Template(bindingDefs, template, blockExpr, root) {
  var self = this;
  self.references = bindingDefs;
  self.template = template;

  if (root === undefined && typeof(blockExpr) === 'object') {
    root = blockExpr;
    blockExpr = undefined;
  }

  self.blockExpr = blockExpr;

  if (root) {
    self.root = root;
  } else {
    var div = createElement('div');
    div.innerHTML = template;
    self.root = div.firstChild;
  }

  self.bindings = {};
  self.children = [];
  self.walk(this.root, bindingDefs.slice(0));
}
TemplateModule.Template = Template;

Template.prototype.clone = function() {
  var self = this;
  return new Template(
    self.references,
    self.template,
    self.root.cloneNode(true));
};

Template.prototype.cloneSub = function() {
  var self = this;
  return new Template(
    self.references,
    self.template,
    self.root.firstChild.cloneNode(true));
};


/**
 * @param {Element} el
 * @param {object[][]} bindingDefs
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
 * @param {object} values
 * @returns {HTMLElement}
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
