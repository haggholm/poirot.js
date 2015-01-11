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

var template = require('./Template')
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
  if (this.opts.verbose) {
    console.log('Processing attribute ' + attr.nodeName);
  }
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
  var match
    , text = node.nodeValue
    , returnNode = node;
  if (this.opts.verbose) {
    console.log('Analysing text: "'+text+'"');
  }

  if (text && (match = mustacheRegex.execAndReset(text)) !== null) {
    if (match[mustacheRegex.IDX_PREAMBLE] === undefined &&
        /^{{[^}]+}}$/.test(text)) {
      // The node is nothing but mustache. Process it.
      returnNode = this.doc.createElement('span');
      if (this.opts.verbose) {
        console.log('Node is all mustache; return SPAN');
      }
      this.processContent(
        getNodeReference(returnNode),
        match[mustacheRegex.IDX_CONTENT]
      );
    } else {

      // The node *contains* mustaches, but is not all mustache.
      // We have to change it to a new node containing references.
      if (this.opts.verbose) {
        console.log('Creating [' + node.parentNode.nodeName + ' >] SPAN');
      }
      returnNode = this.doc.createElement('span');

      var m, child, i, matches = mustacheRegex.execAll(text);
      for (i = 0; i < matches.length; i++) {
        m = matches[i];
        if (m[mustacheRegex.IDX_PREAMBLE] !== undefined) {
          returnNode.appendChild(
            this.doc.createTextNode(m[mustacheRegex.IDX_PREAMBLE])
          );
        }
        child = this.doc.createElement('span');
        child.innerHTML = '{{' + m[mustacheRegex.IDX_CONTENT] + '}}';
        returnNode.appendChild(child);
        this.processElement(child);
      }
      var combinedMatchLength = 0, postMatter;
      _.forEach(matches, function(m) {
        combinedMatchLength += m[0].length;
      });
      if (combinedMatchLength < text.length) {
        postMatter = text.substr(combinedMatchLength);
        returnNode.appendChild(this.doc.createTextNode(postMatter));
      }
      if (returnNode.childNodes.length === 1 &&
          returnNode.firstChild.innerHTML) {
        returnNode = returnNode.firstChild;
      }
    }
  }
  return returnNode;
};

/**
 * @param {HTMLElement} el
 */
function hasOnlyMustacheChild(el) {
  console.log('el.childNodes.length', el.childNodes.length);
  if (el.childNodes.length !== 1) {
    return false;
  }
  var tn = el.firstChild
    , text = tn.nodeValue;
  if (mustacheRegex.execAndReset(text)) {
    console.log('Check', text);
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
  var oldVal;
  if (this.opts.verbose) {
    oldVal = element.nodeName === '#text' ?
      element.nodeValue :
      element.innerHTML;
    console.log('Processing ', element.nodeName+':',oldVal);
  }

  if (element.nodeName === '#text') {
    // Process content. This is only relevant for text nodes.
    return this._processTextNode(element);

  } else {
    // Process attrs.
    _.forEach(element.attributes, this.processAttribute.bind(this));

    if (hasOnlyMustacheChild(element)) {
      var m = mustacheRegex.execAndReset(element.firstChild.nodeValue);
      console.log(element.nodeName, ' has only mustache', m[0]);
      this.processContent(
        getNodeReference(element),
        m[mustacheRegex.IDX_CONTENT]
      );
      element.innerHTML = '';

      if (this.opts.verbose) {
        console.log('Transformed ',oldVal,'->',
          element.nodeName === '#text' ?
          element.nodeValue :
          element.innerHTML
        );
      }
      return element;

    } else {
      // Process child nodes. If any of them return substitutions,
      // well, substitute them.
      var i, child, newChild;
      for (i = element.childNodes.length-1; i >= 0; --i) {
        child = element.childNodes[i];
        console.log('Child', element.nodeName, '>', child.nodeName);
        newChild = this.processElement(child);
        if (newChild !== child) {
          console.log('Substitute',newChild.nodeName,'for',child.nodeName);
          element.replaceChild(newChild, child);
        }
      }

      if (this.opts.verbose) {
        console.log('Transformed \n\t',oldVal,'\n\t->\n\t',
          element.nodeName === '#text' ?
          element.nodeValue :
          element.innerHTML
        );
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
      doc = jsdom('<html><body><div class="poirot-rendered">' + html + '</div></html></body>');
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
  }
};
