#!/usr/bin/env node

'use strict';

var _ = require('lodash')
  , fs = require('fs')
  , path = require('path')
  , poirot = require('../lib/poirot')
  , argv = require('minimist')(process.argv.slice(2));

var outputDir = ('o' in argv || 'outdir' in argv) ?
  (argv.o || argv.outdir) : '.';
var verbose = ('v' in argv || 'verbose' in argv);

var templates = {};
_.forEach(argv._, function(infile) {
  fs.readFile(infile, {encoding: 'utf8'}, function(err, data){
    templates[infile] = data;
    if (_.keys(templates).length === argv._.length) {
      fs.writeFile('out.js', poirot.compile(templates, {verbose: verbose}));
    }
  });
});
