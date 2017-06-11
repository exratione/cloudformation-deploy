/**
 * @fileOverview Resources for testing.
 */

// NPM.
var _ = require('lodash');

// Local.
var utilities = require('../../lib/utilities');

/**
 * Return a deploy configuration object, overwriting its defaults with the
 * provided values.
 *
 * @param {Object} config Optional partial configuration with override values.
 * @return {Object} Configuration object.
 */
exports.getDeployConfig = function (config) {
  return utilities.fillDeployConfigurationDefaults(_.extend({
    clientOptions: undefined,
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

/**
 * Return an update configuration object, overwriting its defaults with the
 * provided values.
 *
 * @param {Object} config Optional partial configuration with override values.
 * @return {Object} Configuration object.
 */
exports.getPreviewUpdateConfig = function (config) {
  return utilities.fillPreviewUpdateConfigurationDefaults(_.extend({
    changeSetName: 'testChangeSet',
    clientOptions: undefined,
    stackName: 'test',
    tags: {
      a: 'b'
    },
    parameters: {
      name: 'value'
    }
  }, config));
};

/**
 * Return an update configuration object, overwriting its defaults with the
 * provided values.
 *
 * @param {Object} config Optional partial configuration with override values.
 * @return {Object} Configuration object.
 */
exports.getUpdateConfig = function (config) {
  return utilities.fillUpdateConfigurationDefaults(_.extend({
    clientOptions: undefined,
    stackName: 'test',
    tags: {
      a: 'b'
    },
    parameters: {
      name: 'value'
    }
  }, config));
};
