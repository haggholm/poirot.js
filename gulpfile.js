'use strict';

var _ = require('lodash')
  , buffer = require('vinyl-buffer')
  , del = require('del')
  , gulp = require('gulp')
  , browserify = require('browserify')
  , sourcemaps = require('gulp-sourcemaps')
  , sourceStream = require('vinyl-source-stream')
  , uglify = require('gulp-uglify');

gulp.task('clean', function(cb){
  del('release', cb);
});

function createBundle(filename, opts) {
  var bundler = browserify(_.extend({}, {
    entries: ['poirot-template.js'],
    debug: true,
    commondir: 'lib',
    paths: ['lib']
  }, opts));
  bundler.require('poirot-template.js', {expose: 'poirot-template'});
  return bundler.bundle()
    .pipe(sourceStream(filename))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(uglify())
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('release'));
}

gulp.task('build-amd', ['clean'], function(){
  return createBundle('poirot-template.min.js', {
    standalone: 'poirot-template'
  });
});

gulp.task('build', ['build-amd']);