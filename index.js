/**
 * @fileOverview Exposed interface for CloudFormation Deploy.
 */

// Local.
var constants = require('./lib/constants');
var Deploy = require('./lib/deploy');

// Exported constants.
exports.capabilities = constants.capabilities;
exports.onFailure = constants.onFailure;
exports.priorInstance = constants.priorInstance;

/**
 * Deploy the specified CloudFormation stack.
 *
 * See the documentation for the form of the config object.
 *
 * @param {Object} config Configuration.
 * @param {Object|String} template The CloudFormation template as either an
 *   object or JSON string, or a URL to a template file in S3 in the same region
 *   as the stack will be deployed to.
 * @param {Function} callback Of the form function (error, result).
 */
exports.deploy = function (config, template, callback) {
  var deploy = new Deploy(config, template);
  deploy.deploy(callback);
};
