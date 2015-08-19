/**
 * @fileOverview Definition file for grunt tasks.
 */

// Core.
var path = require('path');

module.exports = function (grunt) {

  // Always output stack traces.
  grunt.option('stack', true);

  grunt.initConfig({
    eslint: {
      target: [
        '**/*.js',
        '!**/node_modules/**'
      ]
    },

    mochaTest: {
      test: {
        options: {
          reporter: 'spec',
          quiet: false,
          clearRequireCache: false,
          require: [
            path.join(__dirname, 'test/mochaInit.js')
          ]
        },
        src: [
          'test/**/*.spec.js'
        ]
      }
    }
  });

  grunt.loadNpmTasks('grunt-eslint');
  grunt.loadNpmTasks('grunt-mocha-test');

  grunt.registerTask('test', [
    'eslint',
    'mochaTest'
  ]);
};
