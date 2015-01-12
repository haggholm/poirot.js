'use strict';

var _ = require('lodash');


function splitBlocks(text) {
  var m
    , stack = []
    //, blockRegex = /(.+[^{])?({{)(?!.*\{{))([#\/])\s*([^}]*[^}\s])\s*}}/g;
  , blockRegex = /\{{([#\/])\s*([\w]+)\s*\}}/g;

  var ROOT = {
    name: '',
    fragments: []
  };
  stack.push(ROOT);
  var top = 0;

  var lastIndex = 0;
  while ((m = blockRegex.exec(text)) !== null) {
    var tpChar = m[1]
      , isOpening = (tpChar === '#')
      , name = m[2];
    var preamble = '';
    if (m.index > lastIndex) {
      preamble = text.substr(lastIndex, m.index - lastIndex);
    }
    if (tpChar !== '#' && tpChar !== '/') {
      throw 'Unexpected format: '+tpChar+' ('+m[0]+')';
    }
    lastIndex = blockRegex.lastIndex;
    if (isOpening) {
      if (preamble) {
        stack[top].fragments.push(preamble);
      }
      stack.push({
        name: name,
        fragments: []
      });
      ++top;

    } else {
      if (stack[top].name !== name) {
        throw 'Block tag mismatch: Expected closing {{/'+stack[top].name+'}},' +
              'found ' + m[0];
      } else if (top < 1) {
        throw 'Block tag mismatch: Trying to close {{/'+name+'}}, but there ' +
              'is no opening tag';
      }
      if (preamble) {
        stack[top].fragments.push(preamble);
      }
      stack[--top].fragments.push(stack.pop());
    }
  }
  if (lastIndex < text.length) {
    stack[top].fragments.push(text.substr(lastIndex));
  }
  if (top !== 0) {
    throw 'Block tag mismatch: Missing closing tag for '+stack[top].name;
  }
  console.log(stack[top].fragments);
  return stack[top].fragments;
}


function fuseBlocks(stackNode) {
  if (typeof(stackNode) === 'string') {
    console.log('string node', stackNode);
    return stackNode;
  } else {
    console.log('ob node', JSON.stringify(stackNode));
    var inner = _.map(stackNode.fragments, fuseBlocks).join('');
    return '<div data-poirot-block="'+stackNode.name+'">' + inner + '</div>';
  }
}


function blockify(text) {
  return _.map(splitBlocks(text), fuseBlocks).join('');
}


module.exports = function(str) {

};
module.exports.blockify = blockify;
