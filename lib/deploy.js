/**
 * @fileOverview Main deploy class definition.
 */

// Core.
var util = require('util');

// NPM.
var async = require('async');
var _ = require('lodash');

// Local.
var CloudFormationOperation = require('./cloudFormationOperation');
var configValidator = require('./configValidator');
var constants = require('./constants');
var utilities = require('./utilities');

// --------------------------------------------------------------------------
// Class definition.
// --------------------------------------------------------------------------

/**
 * @class Deployment interface class.
 *
 * @param {Object} config Configuration object.
 * @param {Object|String} template The CloudFormation template as either an
 *   object or JSON string, or a URL to a template file in S3 in the same region
 *   as the stack will be deployed to.
 */
function Deploy (config, template) {
  Deploy.super_.call(this, config, template);
  this.config = utilities.fillDeployConfigurationDefaults(this.config);
}
util.inherits(Deploy, CloudFormationOperation);

// -------------------------------------------------------------------------
// Methods.
// -------------------------------------------------------------------------

/**
 * Delete a stack and wait on its completion.
 *
 * Add events to the objects provided, and call back with an error on either a
 * timeout or failure of stack completion.
 *
 * @param {Object} stackData The unique name of the stack to wait on.
 * @param {Function} callback Of the form function (error).
 */
Deploy.prototype.deleteStack = function (stackData, callback) {
  var self = this;

  async.series({
    // Start the deletion underway.
    deleteStack: function (asyncCallback) {
      self.cloudFormation.deleteStack(stackData.stackId, asyncCallback);
    },
    // Wait for it to complete.
    awaitCompletion: function (asyncCallback) {
      self.awaitCompletion(
        constants.type.DELETE_STACK,
        stackData,
        asyncCallback
      );
    }
  }, callback);
};

/**
 * Delete all stacks with tags showing them to be earlier versions of the newly
 * created stack.
 *
 * @param {Object} result The result object, containing all the needed data.
 * @param {Function} callback Of the form function (error).
 */
Deploy.prototype.deletePriorStacks = function (result, callback) {
  var self = this;

  this.cloudFormation.describePriorStacks(
    this.config.baseName,
    result.createStack.stackId,
    function (error, stackDescriptions) {
      if (error) {
        return callback(error);
      }

      if (!stackDescriptions.length) {
        return callback();
      }

      // Running in series just in case. There should only be one or two of
      // these prior stacks.
      async.eachSeries(
        stackDescriptions,
        function (stackDescription, asyncCallback) {
          var stackData = self.getStackData(
            stackDescription.StackName,
            stackDescription.StackId
          );
          result.deleteStack.push(stackData);
          self.deleteStack(stackData, asyncCallback);
        },
        callback
      );
    }
  );
};

/**
 * Deploy the specified CloudFormation stack.
 *
 * See the documentation for the form of the config object.
 *
 * @param {Function} callback Of the form function (error, result).
 */
Deploy.prototype.deploy = function (callback) {
  var self = this;
  var result = {
    errors: [],
    createStack: this.getStackData(utilities.determineStackName(this.config)),
    describeStack: undefined,
    deleteStack: []
  };

  callback = _.once(callback);

  // ------------------------------------------------------------------------
  // Run the stages of the deployment.
  // ------------------------------------------------------------------------

  async.series({
    // Validate the configuration we've been provided.
    validateConfig: function (asyncCallback) {
      var errors = configValidator.validateDeployConfig(self.config);
      if (errors.length) {
        asyncCallback(new Error(JSON.stringify(errors)));
      }
      else {
        asyncCallback();
      }
    },

    // Validate the template.
    validateTemplate: function (asyncCallback) {
      self.cloudFormation.validateTemplate(self.template, asyncCallback);
    },

    // Start the stack creation rolling.
    createStack: function (asyncCallback) {
      self.cloudFormation.createStack(self.template, function (error, data) {
        if (error) {
          return asyncCallback(error);
        }

        result.createStack.stackId = data.StackId;
        asyncCallback();
      });
    },

    // Wait for the stack creation to complete, fail, or timeout, and report on
    // errors and events along the way.
    awaitCompletion: function (asyncCallback) {
      var stackData = result.createStack;
      self.awaitCompletion(
        constants.type.CREATE_STACK,
        stackData,
        function (error) {
          if (error) {
            // Improve on the error messages where possible by adding more
            // context.
            if (
              self.config.onDeployFailure === constants.onDeployFailure.DO_NOTHING &&
              stackData.status === constants.resourceStatus.CREATE_FAILED
            ) {
              asyncCallback(new Error(util.format(
                'Stack creation failed. Per configuration no attempt was made to delete the failed stack: %s',
                error.stack
              )));
            }
            else if (stackData.status === constants.resourceStatus.DELETE_FAILED) {
              asyncCallback(new Error(util.format(
                'Stack creation failed. Deletion of the stack failed as well: %s',
                error.stack
              )));
            }
            else if (stackData.status === constants.resourceStatus.DELETE_COMPLETE) {
              asyncCallback(new Error(util.format(
                'Stack creation failed. The failed stack was deleted: %s',
                error.stack
              )));
            }
            else {
              asyncCallback(error);
            }
          }
          else {
            asyncCallback();
          }
        }
      );
    },

    // Get a stack description, which will contain values set in the Outputs
    // section of the CloudFormation template.
    describeStack: function (asyncCallback) {
      self.cloudFormation.describeStack(
        result.createStack.stackId,
        function (error, description) {
          result.describeStack = description;
          asyncCallback(error);
        }
      );
    },

    // If we have a config.postCreationFn then make use of it now that the
    // stack creation is successful.
    postCreationFn: function (asyncCallback) {
      if (typeof self.config.postCreationFn !== 'function') {
        return asyncCallback();
      }

      self.config.postCreationFn(result.describeStack, asyncCallback);
    },

    // If configuration is set to delete prior stacks, then find them by tag
    // values and delete them.
    deletePriorStacks: function (asyncCallback) {
      if (self.config.priorInstance !== constants.priorInstance.DELETE) {
        return asyncCallback();
      }

      self.deletePriorStacks(result, asyncCallback);
    }
  }, function (error) {
    if (error) {
      result.errors.push(error);
    }

    // Always send back the result regardless.
    callback(error, result);
  });
};

// --------------------------------------------------------------------------
// Exports constructor.
// --------------------------------------------------------------------------

module.exports = Deploy;
