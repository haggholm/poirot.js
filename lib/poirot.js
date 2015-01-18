/**
 * Template-to-DOM framework.
 *
 * @module poirot
 */

/**
 * @external template
 */

/**
 * @name template.Template
 * @class
 */

/**
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
  , serializeDocument = require('jsdom').serializeDocument
  , template = require('./template')
  , Template = template.Template
  , blockParser = require('./block-parser');


/**
 * @param {Document} doc
 * @param {object} opts
 * @constructor
 */
function TemplateBuilder(doc, opts) {
  this.doc = doc;
  this.opts = opts;
  this.references = [];
  this.idx = -1;
}

/**
 * @param {HTMLElement} element
 * @private
 */
TemplateBuilder.prototype.getNodeReference = function(element) {
  if (this.opts.verbose) {
    console.log('getNodeReference');
  }
  if (!element.hasAttribute('data-poirot')) {
    element.setAttribute('data-poirot', '');
    this.idx++;
    this.references.push([]);
  }
  return {};
};


/**
 * @param {Attr} attr
 * @returns {string}
 * @private
 */
TemplateBuilder.prototype.getAttrReference = function(attr) {
  if (this.opts.verbose) {
    console.log('getAttrReference');
  }
  return _.extend({attr: attr.name}, this.getNodeReference(attr.ownerElement));
};

/**
 * @param {object} refObj
 * @param {string} content
 * @param {string} tp
 * @private
 */
TemplateBuilder.prototype.addReference = function(refObj, content, tp) {
  if (this.opts.verbose) {
    console.log('addReference');
  }
  if (this.opts.verbose) {
    console.log(
      'Adding new reference ' + content +
      ' [' + JSON.stringify(tp) + ',' + printOb(refObj) + ']'
    );
  }
  var defn = {
    tp: tp,
    key: content
  };
  if (refObj.attr) {
    defn.at = refObj.attr;
  }
  if (refObj.blockName) {
    defn.bn = refObj.blockName;
  }
  this.references[this.idx].push(defn);
};


var NODE_TYPE_ATTR = 2;

/**
 * @param {HTMLElement|Attr} node
 * @param {Match} match
 * @private
 */
TemplateBuilder.prototype.processContent = function(node, match) {
  if (this.opts.verbose) {
    console.log('processContent', node.outerHTML, match);
  }
  var m = /(?:(.*[^\S])\s+)?(.+)/.exec(match.content)
    , format = m[1]
    , value = m[2];
  var refObj = (node.nodeType === NODE_TYPE_ATTR) ?
    this.getAttrReference(node) :
    this.getNodeReference(node);
  if (format === template.TYPE.ESCAPED && match.open.length === 3) {
    format = template.TYPE.LITERAL;
  }
  switch (format) {
    case template.TYPE.FUNCTION:
      this.addReference(
        refObj,
        value,
        template.TYPE.FUNCTION
      );
      break;
    case template.TYPE.LITERAL:
      this.addReference(
        refObj,
        value,
        template.TYPE.LITERAL
      );
      break;
    case template.TYPE.FRAGMENT:
      m = /.*[^\S]\s+(.+)/g.exec(value);
      var blockName = m[1], blockArgs = m[2];
      refObj.blockName = blockName;
      this.addReference(
        refObj,
        blockArgs,
        template.TYPE.FRAGMENT
      );
      break;
    default:
      this.addReference(
        refObj,
        match.content,
        template.TYPE.ESCAPED
      );
      break;
  }
};

/**
 * @param {string} preamble
 * @param {string} open
 * @param {string} content
 * @param {string} close
 * @param {string} wholeMatch
 * @constructor
 * @private
 */
function Match(preamble, open, content, close, wholeMatch) {
  this.preamble = preamble;
  this.open = open;
  this.close = close;
  this.content = content;
  this.wholeMatch = wholeMatch;

  if (open.replace(/{/g, '}') !== close) {
    throw 'Open/close brace mismatch around ' + content + ' in ' + wholeMatch;
  }
}

function InterpolationParser() {
  this.regex = /(.+[^}])?({{{?)\s*([^}]*[^\s}])\s*(}}}?)/g;
}
var interParser = new InterpolationParser();

/**
 * @param {string[]} match
 * @returns {Match}
 * @private
 */
InterpolationParser.prototype._parse = function(match) {
  if (match === null || match === undefined) {
    return match;
  }
  return new Match(
    match[1],
    match[2],
    match[3],
    match[4],
    match[0]
  );
};
/**
 * @param str
 * @returns {Match}
 */
InterpolationParser.prototype.matchOne = function(str) {
  var m = this.regex.exec(str);
  this.regex.lastIndex = 0;
  return this._parse(m);
};
/**
 * @param str
 * @returns {Match[]}
 */
InterpolationParser.prototype.matchAll = function(str) {
  var matches = [], m;
  while ((m = this.regex.exec(str)) !== null) {
    matches.push(this._parse(m));
  }
  return matches;
};

/**
 * @param {Attr} attr
 * @private
 */
TemplateBuilder.prototype.processAttribute = function(attr) {
  if (this.opts.verbose) {
    console.log('processAttribute', attr.name);
  }
  var m, val = attr.value;
  if (typeof(val) !== 'string') {
    return;
  }
  if ((m = interParser.matchOne(val)) !== null) {
    this.processContent(attr, m);
    attr.value = '';
  }
};


/**
 * @param {Text} node
 * @private
 */
TemplateBuilder.prototype._processTextNode = function(node) {
  if (this.opts.verbose) {
    console.log('_processTextNode', node);
  }
  var match, text = node.nodeValue;

  if (text && (match = interParser.matchOne(text)) !== null) {
    if (/^{{[^}]+}}$/.test(text)) {
      // The node is nothing but mustache. Process it.
      var span = this.doc.createElement('span');
      node.parentNode.replaceChild(span, node);
      this.processContent(span, match);

    } else {

      // The node *contains* mustaches, but is not all mustache.
      // We have to change it to a new node containing references.

      var m, child, i, matches = interParser.matchAll(text);
      for (i = 0; i < matches.length; i++) {
        m = matches[i];
        if (m.preamble !== undefined) {
          node.parentNode.insertBefore(
            this.doc.createTextNode(m.preamble),
            node
          );
        }
        child = this.doc.createElement('span');
        child.innerHTML = m.open + m.content + m.close;
        node.parentNode.insertBefore(child, node);
        this.processElement(child);
      }
      var combinedMatchLength = 0, postMatter;
      _.forEach(matches, function(m) {
        combinedMatchLength += m.wholeMatch.length;
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
 * @private
 */
function hasOnlyMustacheChild(el) {
  if (el.childNodes.length !== 1 || el.firstChild.nodeName !== '#text') {
    return false;
  }
  var tn = el.firstChild
    , text = tn.nodeValue
    , m = interParser.matchOne(text);
  return m && (m.wholeMatch === text);
}

/**
 * @param {HTMLElement} element
 * @private
 */
TemplateBuilder.prototype.addSubTemplate = function(element) {
  if (this.opts.verbose) {
    console.log('addSubTemplate', element.getAttribute('data-poirot-block'));
  }
  var subBuilder = new TemplateBuilder(this.doc, this.opts)
    , innerTemplate = subBuilder.create(element)
    , placeholder = this.doc.createElement(element.nodeName);
  this.getNodeReference(placeholder);
  this.references[this.idx].push(innerTemplate);
  element.parentNode.replaceChild(placeholder, element);
};

/**
 * @param {HTMLElement} element
 * @param {boolean} [isRoot=false]
 * @private
 * @return {HTMLElement} Replacement element, which may or may not be
 *                       the same as the input element.
 */
TemplateBuilder.prototype.processElement = function(element, isRoot) {
  if (this.opts.verbose) {
    console.log('processElement', element.nodeName);
  }
  if (element.nodeName === '#text') {
    // Process content. This is only relevant for text nodes.
    return this._processTextNode(element);
  } else if (element.nodeName === '#document') {
    this.processElement(element.head);
    this.processElement(element.body);

  } else {
    // Process attrs.
    _.forEach(element.attributes, this.processAttribute.bind(this));

    if (isRoot) {
      this.blockExpr = element.getAttribute('data-poirot-block');
    }

    if (element.childNodes.length === 1 &&
        !element.hasAttribute('data-poirot-block') &&
        element.childNodes[0].nodeName !== '#text' &&
        element.childNodes[0].hasAttribute('data-poirot-block'))
    {
      element.setAttribute(
        'data-poirot-block',
        element.childNodes[0].getAttribute('data-poirot-block')
      );
      _.forEach(element.childNodes[0].childNodes, function(n){
        element.appendChild(n);
      });
      element.removeChild(element.firstChild);
    }

    if (!isRoot && element.hasAttribute('data-poirot-block')) {
      this.addSubTemplate(element);

    } else if (hasOnlyMustacheChild(element)) {
      this.processContent(
        element,
        interParser.matchOne(element.firstChild.nodeValue));
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
  if (_.isArray(ob)) {
    return '[' + _.map(ob, printOb).join(',') + ']';
  } else if (ob instanceof Template) {
    return serialize(ob);
  } else if (typeof(ob) === 'object') {
    //return JSON.stringify(ob);
    return '{' + _.map(ob, function(v, k) {
      var props = [];
      if (/^\w+$/.test(k)) {
        props.push(k + ':' + printOb(v));
      } else {
        props.push('"' + JSON.stringify(k) + ':' + JSON.stringify(v));
      }
      return props.join(',');
    }).join(',') + '}';
  } else {
    return JSON.stringify(ob);
  }
}


function serialize(tmpl) {
  return (
    'new Template(' +
    printOb(_.map(tmpl.references, function(defns) {
      return _.map(defns, function(d) {
        if (d instanceof Template) {
          return d;
        } else {
          var res = _.clone(d);
          _.forEach(res, function(v, k) {
            if (k[0] === '_') {
              delete res[k];
            }
          });
          return res;
        }
      });
    })) + ',' +
    stringifyHTML(tmpl.template) +
    (tmpl.blockExpr ? ',' + JSON.stringify(tmpl.blockExpr) : '') +
    ')'
  );
}

function stringifyHTML(html) {
  // HTML often contains rather more double quotes than single quotes; let's
  // reverse it (if profitable).
  var str = JSON.stringify(html)
    , singleQuotes = str.replace(/[^']/g, '').length
    , doubleQuotes = str.replace(/[^"]/g, '').length;
  if (doubleQuotes > singleQuotes && str[0] === '"') {
    str = "'" +
          str.slice(1, str.length-1)
            .replace(/\\"/g, '"')     // Unescape doublequotes "
            .replace(/'/g, "\\'") +   // Escape singlequotes
          "'";
  }

  var alt = '[' + str.split(/data-poirot/g).join(str[0]+','+str[0]) + ']';
  console.log('alt', alt);
  console.log('str', str);
  return alt.length < str.length ? alt : str;
}


TemplateBuilder.prototype.compile = function(root) {
  if (this.opts.verbose) {
    console.log('compile');
  }
  return serialize(this.create(root));
};

TemplateBuilder.prototype.create = function(root) {
  if (this.opts.verbose) {
    console.log('create');
  }
  this.processElement(root, true);
  if (this.opts.verbose) {
    console.log('create template...');
  }
  return new Template(
    this.references,
    serializeDocument(root).replace(/data-poirot=""/g, 'data-poirot'),
    this.blockExpr
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
  if (_.isArray(html)) {
    html = html.join('data-poirot');
  }
  if (typeof(html) === 'string') {
    if (/^(<!doctype [^>\n]+>\n)?<html/.test(html)) {
      doc = root = jsdom(blockParser(html));
    } else {
      doc = jsdom(
        '<!doctype html>\n<html><body><div class="poirot-rendered">' +
        blockParser(html) +
        '</div></html></body>'
      );
      root = doc.body.firstChild;
    }
  } else {
    doc = html.ownerDocument ? html.ownerDocument : html;
  }
  template.setDocument(doc);
  var p = new TemplateBuilder(doc, opts);
  return p[method](root);
}

/**
 * @param {string} html
 * @param {object} opts
 * @returns {string}
 */
module.exports = {
  /**
   * @param {string} html
   * @param {object} opts
   * @returns {string} A compiled Poirot template, which may be output into a
   *    Javascript file and loaded as a CommonJS module.
   */
  compile: function(html, opts) {
    var res = '"use strict";\nvar Template = require("poirot/lib/template");\n';
    if (typeof(html) === 'string') {
      return res +
             'module.exports = ' + createAndRunTemplate(html, opts, 'compile');
    } else {
      var exports = [];
      _.forEach(html, function(html, name) {
        try {
          exports.push(
            JSON.stringify(name) + ':' +
            createAndRunTemplate(html, opts, 'compile')
          );
        } catch (e) {
          console.log('Error processing template '+name);
          throw e;
        }
      });
      res += 'module.exports = {\n' + exports.join(',\n') + '\n};';
      return res;
    }
  },
  /**
   * @param {string} html
   * @param {object} opts
   * @returns {Template}
   */
  create: function(html, opts) {
    var tpl = createAndRunTemplate(html, opts, 'create');
    return tpl.render.bind(tpl);
  },
  Template: Template
};
