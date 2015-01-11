/**
 * Template-to-DOM framework.
 *
 * {{ escaped html }}
 * {{? conditional }}
 * {{! function (use to bind event handlers) }}
 * {{{ unescaped html }}}
 * {{# numeric }}
 * {{~ iteration }}
 */

'use strict';

var _ = require('lodash')
  , jsdom = require('jsdom').jsdom
  , serializeDocument = require('jsdom').serializeDocument;

var FlakeIdGen = require('flake-idgen')
  , intformat = require('biguint-format')
  , generator = new FlakeIdGen();

var template = require('./poirot-template')
  , Template = template.Template;


function getRandomId() {
  return 'Tx' + intformat(generator.next(), 'hex');
}

/**
 * @param {Element} element
 */
function getNodeReference(element) {
  if (element.hasAttribute(template.DOM_NODE_ID)) {
    return {id: element.getAttribute(template.DOM_NODE_ID)};
  } else {
    var id = getRandomId();
    element.setAttribute(template.DOM_NODE_ID, id);
    return {id: id};
  }
}


/**
 * @param {Attr} attr
 * @returns {string}
 */
function getAttrReference(attr) {
  return _.extend({attr: attr.name}, getNodeReference(attr.ownerElement));
}


/**
 * @param {Document} doc
 * @constructor
 */
function Processor(doc, opts) {
  this.doc = doc;
  this.opts = opts;
  this.references = {};
}

Processor.prototype.addReference = function(refObj, content, tp) {
  if (this.opts.verbose) {
    console.log(
      'Adding new reference ' + content +
      ' [' + JSON.stringify(tp) + ',' + printOb(refObj) + ']'
    );
  }
  this.references[content] = {
    tp: tp,
    id: refObj.id
  };
  if (refObj.attr) {
    this.references[content].at = refObj.attr;
  }
};

Processor.prototype.processContent = function(refObj, content) {
  switch (content) {
    case '!':
      this.addReference(
        refObj,
        content.substr(1).replace(/^\s+/, ''),
        template.TYPE.FUNCTION
      );
      break;
    case '|':
      this.addReference(
        refObj,
        content.substr(1).replace(/^\s+/, ''),
        template.TYPE.LITERAL
      );
      break;
    default:
      this.addReference(
        refObj,
        content,
        template.TYPE.ESCAPED
      );
      break;
  }
};

var mustacheRegex = /(.+)?\{{\s*([^}]*[^\s}])\s*}}/g;
mustacheRegex.IDX_PREAMBLE = 1;
mustacheRegex.IDX_CONTENT = 2;
mustacheRegex.execAndReset = function(str) {
  var m = this.exec(str);
  this.lastIndex = 0;
  return m;
};
mustacheRegex.execAll = function(str) {
  var matches = [], m;
  while ((m = this.exec(str)) !== null) {
    matches.push(m);
  }
  return matches;
};

/**
 * @param {Attr} attr
 */
Processor.prototype.processAttribute = function(attr) {
  var val = attr.value;
  if (typeof(val) !== 'string') {
    return;
  }
  var m = mustacheRegex.exec(val);
  mustacheRegex.lastIndex = 0;
  if (m) {
    this.processContent(getAttrReference(attr), m[mustacheRegex.IDX_CONTENT]);
    attr.value = '';
  }
};


/**
 * @param {Text} node
 * @private
 */
Processor.prototype._processTextNode = function(node) {
  var match, text = node.nodeValue;

  if (text && (match = mustacheRegex.execAndReset(text)) !== null) {
    if (/^{{[^}]+}}$/.test(text)) {
      // The node is nothing but mustache. Process it.
      var span = this.doc.createElement('span');
      node.parent.replaceChild(span, node);
      this.processContent(
        getNodeReference(span),
        match[mustacheRegex.IDX_CONTENT]
      );
    } else {

      // The node *contains* mustaches, but is not all mustache.
      // We have to change it to a new node containing references.

      var m, child, i, matches = mustacheRegex.execAll(text);
      for (i = 0; i < matches.length; i++) {
        m = matches[i];
        if (m[mustacheRegex.IDX_PREAMBLE] !== undefined) {
          node.parentNode.insertBefore(
            this.doc.createTextNode(m[mustacheRegex.IDX_PREAMBLE]),
            node
          );
        }
        child = this.doc.createElement('span');
        child.innerHTML = '{{' + m[mustacheRegex.IDX_CONTENT] + '}}';
        node.parentNode.insertBefore(child, node);
        this.processElement(child);
      }
      var combinedMatchLength = 0, postMatter;
      _.forEach(matches, function(m) {
        combinedMatchLength += m[0].length;
      });
      if (combinedMatchLength < text.length) {
        postMatter = text.substr(combinedMatchLength);
        node.parentNode.insertBefore(this.doc.createTextNode(postMatter), node);
      }
      node.parentNode.removeChild(node);
    }
  }
};

/**
 * @param {HTMLElement} el
 */
function hasOnlyMustacheChild(el) {
  if (el.childNodes.length !== 1) {
    return false;
  }
  var tn = el.firstChild
    , text = tn.nodeValue;
  if (mustacheRegex.execAndReset(text)) {
    return /^{{[^}]+}}$/.test(text);
  } else {
    return false;
  }
}

/**
 * @param {Element} element
 * @return {Element} Replacement element, which may or may not be
 *                   the same as the input element.
 */
Processor.prototype.processElement = function(element) {
  if (element.nodeName === '#text') {
    // Process content. This is only relevant for text nodes.
    return this._processTextNode(element);

  } else {
    // Process attrs.
    _.forEach(element.attributes, this.processAttribute.bind(this));

    if (hasOnlyMustacheChild(element)) {
      var m = mustacheRegex.execAndReset(element.firstChild.nodeValue);
      this.processContent(
        getNodeReference(element),
        m[mustacheRegex.IDX_CONTENT]
      );
      element.innerHTML = '';
      return element;

    } else {
      // Process child nodes.
      var next, child = element.firstChild;
      while (child) {
        next = child.nextSibling;
        this.processElement(child);
        child = next;
      }
      return element;
    }
  }
};

function printOb(ob) {
  if (typeof(ob) === 'object') {
    return '{' + _.map(ob, function(v, k) {
      var props = [];
      if (/^\w+$/.test(k)) {
        props.push(k + ':' + printOb(v));
      } else {
        props.push('"' + JSON.stringify(k) + ':' + JSON.stringify(v));
      }
      return props.join(',');
    }).join(',') + '}';
  } else if (_.isArray(ob)) {
    return '[' + _.map(ob, printOb).join(',') + ']';
  } else {
    return JSON.stringify(ob);
  }
}


Processor.prototype.compile = function(root) {
  this.processElement(root);
  return 'module.exports = new Template(' +
         printOb(this.references) + ',' +
         "'" + serializeDocument(root).replace(/'/g, "\\'") + "');";
};

Processor.prototype.create = function(root) {
  this.processElement(root);
  return new Template(
    this.references,
    serializeDocument(root)
  );
};

/**
 * @param {string|jsdom} html
 * @param opts
 * @param method
 * @returns {*}
 */
function createAndRunTemplate(html, opts, method) {
  opts = opts || {};
  var doc, root;
  if (typeof(html) === 'string') {
    if (/^(<!doctype \w+>\n)?<html/.test(html)) {
      root = doc = jsdom(html);
    } else {
      doc = jsdom(
        '<html><body><div class="poirot-rendered">' +
        html +
        '</div></html></body>'
      );
      root = doc.body.firstChild;
    }
  } else {
    doc = html.ownerDocument ? html.ownerDocument : html;
  }
  template.setDocument(doc);
  var p = new Processor(doc, opts);
  return p[method](root);
}

/**
 * @param {string} html
 * @param {object} opts
 * @returns {string}
 */
module.exports = {
  compile: function(html, opts) {
    return createAndRunTemplate(html, opts, 'compile');
  },
  create: function(html, opts) {
    var tpl = createAndRunTemplate(html, opts, 'create');
    return tpl.render.bind(tpl);
  },
  Template: Template
};
