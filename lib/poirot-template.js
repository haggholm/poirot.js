'use strict';


var TYPES = {
  FUNCTION: 'F',
  ESCAPED: '',
  LITERAL: 'L',
  NUMERAL: 'N'
};

/**
 * @param {string} html
 * @param {object} bindings
 * @returns {function(this:Template)}
 * @constructor
 */
var TemplateModule;
module.exports = TemplateModule = function(html, bindings) {
  return Template.prototype.render.bind(new Template(html, bindings));
};

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

var createTextNode = function(text) {
  // jshint browser: true
  return document.createTextNode(text);
};

/**
 * Provide a function to create HTMLElements.
 * @param {Document} doc
 */
TemplateModule.setDocument = function(doc) {
  createElement = doc.createElement.bind(doc);
  createTextNode = doc.createTextNode.bind(doc);
};

TemplateModule.TYPE = TYPES;
TemplateModule.DOM_NODE_ID = 'data-tpl-id';

var renderFunctions = {};

/**
 * @param {string} code
 * @param {function} handler
 * @returns {TemplateModule} Returns the module object for chaining
 */
TemplateModule.registerHandler = function(code, handler) {
  if (renderFunctions[code] !== undefined) {
    throw 'A handler for template code '+code+' already exists';
  }
  renderFunctions[code] = handler;
  return this;
};

/**
 * @param {string} code
 * @returns {function}
 */
TemplateModule.getHandler = function(code) {
  return renderFunctions[code];
};



TemplateModule.registerHandler(TYPES.FUNCTION,
  function(target, value, isAttr) {
    if (isAttr) {
      target.value = value;
    } else {
      renderFunctions[TYPES.ESCAPED](target, value(), false);
    }
  });

TemplateModule.registerHandler(TYPES.ESCAPED, function(target, value, isAttr) {
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

TemplateModule.registerHandler(TYPES.LITERAL, function(target, value, isAttr) {
  if (isAttr) {
    target.value = value;
  } else {
    target.innerHTML = value;
  }
});

TemplateModule.registerHandler(TYPES.NUMERAL, function(target, value, isAttr) {
  var v = isNaN(value) ? 'NaN' : value;
  if (isAttr) {
    target.value = v;
  } else {
    target.innerHTML = v;
  }
});


/**
 * @param {object[]} bindingDefs
 * @param {string} html
 * @constructor
 */
function Template(bindingDefs, html) {
  this.elements = {};
  this.bindings = {};

  var div = createElement('div');
  div.innerHTML = html;
  this.root = div.firstChild;

  var subKey, id, defn, el
    , elements = div.querySelectorAll(TemplateModule.ID_SELECTOR)
    , bindingDefsById = {};

  for (var key in bindingDefs) { // jshint ignore:line
    defn = bindingDefs[key];
    defn.key = key;
    subKey = defn.at || '';
    if (bindingDefsById[defn.id] === undefined) {
      bindingDefsById[defn.id] = {};
    }
    bindingDefsById[defn.id][subKey] = defn;
  }

  for (var i = elements.length-1; i >= 0; i--) {
    el = elements[i];
    id = el.getAttribute(TemplateModule.DOM_NODE_ID);
    el.removeAttribute(TemplateModule.DOM_NODE_ID);
    if (id in bindingDefsById) {
      for (subKey in bindingDefsById[id]) { // jshint ignore:line
        defn = bindingDefsById[id][subKey];
        this.bindings[defn.key] = defn;
        defn.target = defn.at === undefined ? el : el.getAttributeNode(defn.at);
        defn.render = renderFunctions[defn.tp];
      }
    }
  }
}
TemplateModule.ID_SELECTOR = '[' + TemplateModule.DOM_NODE_ID + ']';
TemplateModule.Template = Template;

var CLEAR = Template.CLEAR = {};

/**
 * @param {object} values
 * @returns {HTMLElement}
 */
Template.prototype.render = function(values) {
  var key, value, defn, res, target;
  for (key in values) {         // jshint ignore:line
    defn = this.bindings[key];  // jshint ignore:line
    if (defn !== undefined) {
      value = values[key];      // jshint ignore:line
      target = defn.target;
      try {
        if (value !== CLEAR) {
          defn.render(target, value, defn.at);
        }
      } catch (e) {
        console.error('Failed to render value:', value);
        console.error(e);
        console.trace();
        res = '#ERROR';
      }
    }
  }

  return this.root;
};


module.exports = TemplateModule;
