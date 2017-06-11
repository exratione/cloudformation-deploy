/**
 * @fileOverview A parent class definition for CloudFormation operations.
 */

// Core.
var util = require('util');

// NPM.
var async = require('async');
var _ = require('lodash');

// Local.
var CloudFormation = require('./cloudFormation');
var constants = require('./constants');

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
function CloudFormationOperation (config, template) {
  this.config = config;
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
CloudFormationOperation.prototype.getStackData = function (stackName, stackId) {
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
 * @param {Object} stackData The unique name of the stack to wait on.
 * @param {Function} callback Of the form function (error).
 */
CloudFormationOperation.prototype.updateEventData = function (stackData, callback) {
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
 * Wait on the completion of a stack operation, such as creation, deletion, or
 * update.
 *
 * A stack creation that is set to automatically delete on failure will run
 * through all of a failed creation and then a successful deletion within this
 * one method.
 *
 * This adds events to the objects provided, and calls back with an error on
 * either a timeout or failure of the stack operation to complete.
 *
 * (Exported only to make testing easier, not because it should be used
 * directly).
 *
 * @param {Object} type The type of stack operation.
 * @param {Object} stackData The unique name of the stack to wait on.
 * @param {Function} callback Of the form function (error).
 */
CloudFormationOperation.prototype.awaitCompletion = function (type, stackData, callback) {
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
      if (self.config.onDeployFailure === constants.onDeployFailure.DELETE) {
        return _.includes([
          constants.resourceStatus.CREATE_COMPLETE,
          constants.resourceStatus.DELETE_COMPLETE,
          constants.resourceStatus.DELETE_FAILED
        ], stackData.status);
      }
      // Otherwise creation complete or failed status is good enough to stop on.
      else {
        return _.includes([
          constants.resourceStatus.CREATE_COMPLETE,
          constants.resourceStatus.CREATE_FAILED
        ], stackData.status);
      }
    }
    // Otherwise for deleting a stack, check for the delete outcomes.
    else if (type === constants.type.DELETE_STACK) {
      return _.includes([
        constants.resourceStatus.DELETE_COMPLETE,
        constants.resourceStatus.DELETE_FAILED
      ], stackData.status);
    }
    // Otherwise we are updating a stack, and looking for completion or rollback
    // outcomes.
    else {
      return _.includes([
        constants.resourceStatus.UPDATE_COMPLETE,
        constants.resourceStatus.UPDATE_ROLLBACK_COMPLETE,
        constants.resourceStatus.UPDATE_ROLLBACK_FAILED
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
      else if (
        type === constants.type.UPDATE_STACK &&
        stackData.status === constants.resourceStatus.UPDATE_COMPLETE
      ) {
        callback();
      }
      else {
        // Find the first interesting event likely to signal a failure.
        var failureEvent = _.find(stackData.events, function (event) {
          return event.ResourceStatus && /FAILED/.test(event.ResourceStatus);
        });

        if (failureEvent) {
          callback(new Error(util.format(
            'Stack operation failed on the following event: %s',
            JSON.stringify(failureEvent)
          )));
        }
        else {
          callback(new Error(util.format(
            'Stack operation failed, but could not identify failure event.'
          )));
        }
      }
    }
  );
};

// --------------------------------------------------------------------------
// Exports constructor.
// --------------------------------------------------------------------------

module.exports = CloudFormationOperation;
