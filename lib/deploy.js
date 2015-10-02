/**
 * @fileOverview Deployment functions.
 */

// Core.
var util = require('util');

// NPM.
var async = require('async');
var _ = require('lodash');

// Local.
var cloudFormation = require('./cloudFormation');
var configValidator = require('./configValidator');
var constants = require('./constants');
var utilities = require('./utilities');

// -------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------

/**
 * Get a data object to be contained by the overall result object.
 *
 * (Exported only to make testing easier).
 *
 * @param {String} stackName The full name of the stack.
 * @param {String} stackId The unique ID of the stack, if known.
 * @return {Object} An object to be contained in the larger result object.
 */
exports.getStackData = function (stackName, stackId) {
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
 * @param {Object} config Configuration.
 * @param {Function} callback Of the form function (error).
 */
exports.updateEventData = function (stackData, config, callback) {
  // This provides us with all events, annoyingly. Can't constrain it to just
  // the recent ones we're interested in.
  cloudFormation.describeStackEvents(stackData.stackId, config, function (error, events) {
    if (error) {
      return callback(error);
    }

    // Just look at the new events from this time around.
    var newEvents = events.slice(stackData.events.length);
    // Replace existing events data with what we get.
    stackData.events = events;

    // Fire off functions in response to events.
    if (typeof config.onEventFn === 'function') {
      _.each(newEvents, config.onEventFn);
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
  });
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
 * @param {Object} config Configuration.
 * @param {Function} callback Of the form function (error).
 */
exports.awaitCompletion = function (type, stackData, config, callback) {
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
      if (config.onFailure === constants.onFailure.DELETE) {
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
        exports.updateEventData(stackData, config, asyncCallback);
      }, config.progressCheckIntervalInSeconds * 1000);
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
 * (Exported only to make testing easier).
 *
 * @param {Object} stackData The unique name of the stack to wait on.
 * @param {Object} config Configuration.
 * @param {Function} callback Of the form function (error).
 */
exports.deleteStack = function (stackData, config, callback) {
  async.series({
    // Start the deletion underway.
    deleteStack: function (asyncCallback) {
      cloudFormation.deleteStack(stackData.stackId, config, asyncCallback);
    },
    // Wait for it to complete.
    awaitCompletion: function (asyncCallback) {
      exports.awaitCompletion(
        constants.type.DELETE_STACK,
        stackData,
        config,
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
 * @param {Object} config Configuration.
 * @param {Function} callback Of the form function (error).
 */
exports.deletePriorStacks = function (result, config, callback) {
  cloudFormation.describePriorStacks(
    config.baseName,
    result.createStack.stackId,
    config,
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
          var stackData = exports.getStackData(
            stackDescription.StackName,
            stackDescription.StackId
          );
          result.deleteStack.push(stackData);
          exports.deleteStack(stackData, config, asyncCallback);
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
 * @param {Object} config Configuration.
 * @param {Object|String} template The CloudFormation template as either an
 *   object or JSON string, or a URL to a template file in S3 in the same region
 *   as the stack will be deployed to.
 * @param {Function} callback Of the form function (error, result).
 */
exports.deploy = function (config, template, callback) {
  var result = {
    errors: [],
    createStack: exports.getStackData(utilities.getStackName(config)),
    describeStack: undefined,
    deleteStack: []
  };

  callback = _.once(callback);
  config = utilities.fillConfigurationDefaults(config);

  // ------------------------------------------------------------------------
  // Run the stages of the deployment.
  // ------------------------------------------------------------------------

  async.series({
    // Validate the configuration we've been provided.
    validateConfig: function (asyncCallback) {
      var errors = configValidator.validate(config);
      if (errors.length) {
        asyncCallback(new Error(JSON.stringify(errors)));
      }
      else {
        asyncCallback();
      }
    },

    // Validate the template.
    validateTemplate: function (asyncCallback) {
      cloudFormation.validateTemplate(template, config, asyncCallback);
    },

    // Start the stack creation rolling.
    createStack: function (asyncCallback) {
      cloudFormation.createStack(config, template, function (error, data) {
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
      exports.awaitCompletion(
        constants.type.CREATE_STACK,
        stackData,
        config,
        function (error) {
          if (error) {
            // Improve on the error messages where possible by adding more
            // context.
            if (
              config.onFailure === constants.onFailure.DO_NOTHING &&
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
      cloudFormation.describeStack(
        result.createStack.stackId,
        config,
        function (error, description) {
          result.describeStack = description;
          asyncCallback(error);
        }
      );
    },

    // If we have a config.postCreationFn then make use of it now that the
    // stack creation is successful.
    postCreationFn: function (asyncCallback) {
      if (typeof config.postCreationFn !== 'function') {
        return asyncCallback();
      }

      config.postCreationFn(result.describeStack, asyncCallback);
    },

    // If configuration is set to delete prior stacks, then find them by tag
    // values and delete them.
    deletePriorStacks: function (asyncCallback) {
      if (config.priorInstance !== constants.priorInstance.DELETE) {
        return asyncCallback();
      }

      exports.deletePriorStacks(result, config, asyncCallback);
    }
  }, function (error) {
    if (error) {
      result.errors.push(error);
    }

    // Always send back the result regardless.
    callback(error, result);
  });
};
