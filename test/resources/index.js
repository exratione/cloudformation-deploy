/**
 * @fileOverview Resources for testing.
 */

// NPM.
var _ = require('lodash');

// Local.
var utilities = require('../../lib/utilities');

/**
 * Return a configuration object, overwriting its defaults with values passed
 * in.
 *
 * @param {Object} config Optional partial configuration with override values.
 * @return {Object} Configuration object.
 */
exports.getConfig = function (config) {
  return utilities.fillConfigurationDefaults(_.extend({
    baseName: 'test',
    version: '1.0.0',
    deployId: '1',
    tags: {
      a: 'b'
    },
    parameters: {
      name: 'value'
    }
  }, config));
};
