/**
 * @fileOverview Main deploy class definition.
 */

// Core.
var util = require('util');

// NPM.
var async = require('async');
var _ = require('lodash');

// Local.
var CloudFormation = require('./cloudFormation');
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
  this.config = utilities.fillConfigurationDefaults(config);
  this.template = template;
  this.cloudFormation = new CloudFormation(this.config);
}

// -------------------------------------------------------------------------
// Methods.
// -------------------------------------------------------------------------

/**
 * Get a data object to be contained by the overall result object.
 *
 * @param {String} stackName The full name of the stack.
 * @param {String} stackId The unique ID of the stack, if known.
 * @return {Object} An object to be contained in the larger result object.
 */
Deploy.prototype.getStackData = function (stackName, stackId) {
  return {
    stackName: stackName,
    stackId: stackId,
    status: undefined,
    events: []
  };
};

/**
 * Load events for the stack and update the stackData.
 *
 * (Exported only to make testing easier).
 *
 * @param {Object} stackData The unique name of the stack to wait on.
 * @param {Function} callback Of the form function (error).
 */
Deploy.prototype.updateEventData = function (stackData, callback) {
  var self = this;
  // This provides us with all events, annoyingly. Can't constrain it to just
  // the recent ones we're interested in.
  this.cloudFormation.describeStackEvents(
    stackData.stackId,
    function (error, events) {
      if (error) {
        return callback(error);
      }

      // Just look at the new events from this time around.
      var newEvents = events.slice(stackData.events.length);
      // Replace existing events data with what we get.
      stackData.events = events;

      // Fire off functions in response to events.
      if (typeof self.config.onEventFn === 'function') {
        _.each(newEvents, self.config.onEventFn);
      }

      // Events are in chronological order. So look for the last event that refers
      // to the template itself and the current status is that status.
      newEvents = _.dropRightWhile(newEvents, function (event) {
        return event.ResourceType !== constants.resourceType.STACK;
      });

      if (newEvents.length) {
        stackData.status = _.last(newEvents).ResourceStatus;
      }

      callback();
    }
  );
};

/**
 * Wait on the completion of either a stack creation or deletion.
 *
 * A stack that is set to automatically delete on failure will run through all
 * of a failed creation and then a successful deletion within this one method.
 *
 * Add events to the objects provided, and call back with an error on either a
 * timeout or failure of stack completion.
 *
 * (Exported only to make testing easier).
 *
 * @param {Object} type Is this a stack creation or deletion?
 * @param {Object} stackData The unique name of the stack to wait on.
 * @param {Function} callback Of the form function (error).
 */
Deploy.prototype.awaitCompletion = function (type, stackData, callback) {
  var self = this;
  callback = _.once(callback);

  /**
   * Which status to watch for completion depends on whether or not
   * configuration is set to delete a failed stack automatically.
   *
   * @return {Boolean} True if complete.
   */
  function isComplete () {
    if (type === constants.type.CREATE_STACK) {
      // If we are deleting a stack automatically on failed creation, then this
      // is only complete when we hit a completion for creation or deletion. In
      // this case CREATE_FAILED is just a step along the way.
      if (self.config.onFailure === constants.onFailure.DELETE) {
        return _.contains([
          constants.resourceStatus.CREATE_COMPLETE,
          constants.resourceStatus.DELETE_COMPLETE,
          constants.resourceStatus.DELETE_FAILED
        ], stackData.status);
      }
      // Otherwise creation complete or failed status is good enough to stop on.
      else {
        return _.contains([
          constants.resourceStatus.CREATE_COMPLETE,
          constants.resourceStatus.CREATE_FAILED
        ], stackData.status);
      }
    }
    // Otherwise for deleting a stack, check for the delete outcomes.
    else {
      return _.contains([
        constants.resourceStatus.DELETE_COMPLETE,
        constants.resourceStatus.DELETE_FAILED
      ], stackData.status);
    }
  }

  async.until(
    // Truth test - continue running the next function argument until this test
    // returns true.
    isComplete,

    // Wait for the progress check interval then load the events and see what's
    // new. Update the stackData object along the way.
    function (asyncCallback) {
      setTimeout(function () {
        self.updateEventData(stackData, asyncCallback);
      }, self.config.progressCheckIntervalInSeconds * 1000);
    },

    // Once the truth test returns true, or an error is generated, then here we
    // are.
    function (error) {
      if (error) {
        return callback(error);
      }

      // Look at the last status to figure out whether or not to call back with
      // an error.
      //
      // Note that we call back with an error on a successful delete of a failed
      // stack create.
      if (
        type === constants.type.CREATE_STACK &&
        stackData.status === constants.resourceStatus.CREATE_COMPLETE
      ) {
        callback();
      }
      else if (
        type === constants.type.DELETE_STACK &&
        stackData.status === constants.resourceStatus.DELETE_COMPLETE
      ) {
        callback();
      }
      else {
        callback(new Error(util.format(
          '%s for %s',
          stackData.status,
          stackData.stackName
        )));
      }
    }
  );
};

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
    createStack: this.getStackData(utilities.getStackName(this.config)),
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
      var errors = configValidator.validate(self.config);
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
              self.config.onFailure === constants.onFailure.DO_NOTHING &&
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
