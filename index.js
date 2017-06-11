/**
 * @fileOverview Exposed interface for CloudFormation Deploy.
 */

// Local.
var constants = require('./lib/constants');
var Deploy = require('./lib/deploy');
var PreviewUpdate = require('./lib/previewUpdate');
var Update = require('./lib/update');

// Exported constants.
exports.capabilities = constants.capabilities;
exports.onDeployFailure = constants.onDeployFailure;
exports.priorInstance = constants.priorInstance;

/**
 * Deploy the specified CloudFormation template to create a new stack or replace
 * an existing stack.
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

/**
 * Preview a stack update by creating a changeset and inspecting its details.
 *
 * See the documentation for the form of the config object.
 *
 * @param {Object} config Configuration.
 * @param {Object|String} template The CloudFormation template as either an
 *   object or JSON string, or a URL to a template file in S3 in the same region
 *   as the stack will be deployed to.
 * @param {Function} callback Of the form function (error, result).
 */
exports.previewUpdate = function (config, template, callback) {
  var previewUpdate = new PreviewUpdate(config, template);
  previewUpdate.previewUpdate(callback);
};

/**
 * Deploy the specified CloudFormation template to update an existing stack.
 *
 * See the documentation for the form of the config object.
 *
 * @param {Object} config Configuration.
 * @param {Object|String} template The CloudFormation template as either an
 *   object or JSON string, or a URL to a template file in S3 in the same region
 *   as the stack will be deployed to.
 * @param {Function} callback Of the form function (error, result).
 */
exports.update = function (config, template, callback) {
  var update = new Update(config, template);
  update.update(callback);
};
