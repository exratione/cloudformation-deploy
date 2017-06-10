/**
 * @fileOverview Main update class definition.
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
 * @class Update interface class.
 *
 * @param {Object} config Configuration object.
 * @param {Object|String} template The CloudFormation template as either an
 *   object or JSON string, or a URL to a template file in S3 in the same region
 *   as the stack will be deployed to.
 */
function Update (config, template) {
  Update.super_.call(this, config, template);
  this.config = utilities.fillUpdateConfigurationDefaults(this.config);
}
util.inherits(Update, CloudFormationOperation);

// -------------------------------------------------------------------------
// Methods.
// -------------------------------------------------------------------------

/**
 * Update the specified CloudFormation stack.
 *
 * See the documentation for the form of the config object.
 *
 * @param {Function} callback Of the form function (error, result).
 */
Update.prototype.update = function (callback) {
  var self = this;
  var result = {
    errors: [],
    updateStack: this.getStackData(utilities.determineStackName(this.config)),
    describeStack: undefined
  };

  callback = _.once(callback);

  // ------------------------------------------------------------------------
  // Run the stages of the deployment.
  // ------------------------------------------------------------------------

  async.series({
    // Validate the configuration we've been provided.
    validateConfig: function (asyncCallback) {
      var errors = configValidator.validateUpdateConfig(self.config);
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

    // Start the stack update rolling.
    updateStack: function (asyncCallback) {
      self.cloudFormation.updateStack(self.template, function (error, data) {
        if (error) {
          return asyncCallback(error);
        }

        result.updateStack.stackId = data.StackId;
        asyncCallback();
      });
    },

    // Wait for the stack creation to complete, fail, or timeout, and report on
    // errors and events along the way.
    awaitCompletion: function (asyncCallback) {
      var stackData = result.updateStack;
      self.awaitCompletion(
        constants.type.UPDATE_STACK,
        stackData,
        function (error) {
          if (error) {
            // Improve on the error messages where possible by adding more
            // context.
            if (stackData.status === constants.resourceStatus.UPDATE_ROLLBACK_COMPLETE) {
              asyncCallback(new Error(util.format(
                'Stack update failed. The rollback succeeded: %s',
                error.stack
              )));
            }
            else if (stackData.status === constants.resourceStatus.UPDATE_ROLLBACK_FAILED) {
              asyncCallback(new Error(util.format(
                'Stack update failed. The rollback failed as well: %s',
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
        result.updateStack.stackId,
        function (error, description) {
          result.describeStack = description;
          asyncCallback(error);
        }
      );
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

module.exports = Update;
