/**
 * @fileOverview Exposed interface for CloudFormation Deploy.
 */

// Local.
var constants = require('./lib/constants');
var deploy = require('./lib/deploy');

// Exported constants.
exports.onFailure = constants.onFailure;
exports.priorInstance = constants.priorInstance;

// The main deployment function.
exports.deploy = deploy.deploy;
