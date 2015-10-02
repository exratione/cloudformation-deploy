/**
 * @fileOverview CloudFormation functions.
 */

// Core.
var util = require('util');

// NPM.
var async = require('async');
var AWS = require('aws-sdk');
var _ = require('lodash');

// Local.
var constants = require('./constants');
var utilities = require('./utilities');

// --------------------------------------------------------------------------
// Variables.
// --------------------------------------------------------------------------

// The AWS.CloudFormation client will be set here. It is exported for test
// purposes.
//
// Creation of the client is late and lazy because this helps with situations in
// which you want to carry out different AWS actions with different
// configurations in the same process. You can load this module up front and it
// won't create the client until it is used.
exports.client = undefined;

// Status filters for listStacks API.
exports.stackStatusFilter = [
  'CREATE_IN_PROGRESS',
  'CREATE_FAILED',
  'CREATE_COMPLETE',
  'ROLLBACK_IN_PROGRESS',
  'ROLLBACK_FAILED',
  'ROLLBACK_COMPLETE',
  'DELETE_FAILED'
];

// --------------------------------------------------------------------------
// Functions.
// --------------------------------------------------------------------------

/**
 * Ensure that we have an AWS CloudFormation client.
 *
 * @param {Object} config Configuration object.
 */
exports.ensureClient = function (config) {
  if (!exports.client) {
    if (typeof config.clientOptions === 'object') {
      // Settings via config. Not recommended.
      exports.client = new AWS.CloudFormation(config.clientOptions);
    }
    else {
      // Assuming the setting of credentials via environment variable,
      // credentials file, role, etc.
      exports.client = new AWS.CloudFormation();
    }
  }
};

/**
 * Issue a request to start creation of a stack.
 *
 * Data returned has the form:
 *
 * {
 *   StackId: ''
 * }
 *
 * @param {Object} config The configuration.
 * @param {String} template The template, or a URL to the template.
 * @param {Function} callback Of the form function (error, data).
 */
exports.createStack = function (config, template, callback) {
  exports.ensureClient(config);

  var params = {
    StackName: utilities.getStackName(config),
    // Most stacks will need this, so may as well include it for all.
    Capabilities: ['CAPABILITY_IAM'],
    OnFailure: config.onFailure,
    Parameters: utilities.getParameters(config),
    Tags: utilities.getTags(config),
    TimeoutInMinutes: config.createStackTimeoutInMinutes
  };

  utilities.addTemplatePropertyToParameters(params, template);
  exports.client.createStack(params, function (error, data) {
    if (error) {
      return callback(new Error(util.format(
        'Call to createStack failed: %s',
        error
      )));
    }

    callback(null, data);
  });
};

/**
 * Issue a request to start deletion of a stack.
 *
 * @param {String} stackId The stack ID.
 * @param {Object} config The configuration.
 * @param {Function} callback Of the form function (error).
 */
exports.deleteStack = function (stackId, config, callback) {
  exports.ensureClient(config);

  var params = {
    StackName: stackId
  };

  exports.client.deleteStack(params, function (error) {
    if (error) {
      return callback(new Error(util.format(
        'Call to deleteStack failed: %s',
        error
      )));
    }

    callback();
  });
};

/**
 * Obtain a stack description, which will include the parameters specified in
 * the Outputs section of the CloudFormation template.
 *
 * @param {String} stackId The stack ID.
 * @param {Object} config The configuration.
 * @param {Function} callback Of the form function (error).
 */
exports.describeStack = function (stackId, config, callback) {
  exports.ensureClient(config);

  var params = {
    StackName: stackId
  };

  exports.client.describeStacks(params, function (error, result) {
    if (error) {
      return callback(new Error(util.format(
        'Call to describeStacks failed: %s',
        error
      )));
    }

    if (!result.Stacks.length) {
      return callback(new Error(util.format(
        'No such stack: %s',
        stackId
      )));
    }

    callback(null, result.Stacks[0]);
  });
};

/**
 * Obtain a stack description for all of the stacks with tags matching the newly
 * deploy stack's base name tag.
 *
 * This unfortunately requires listing all stacks in the account, but that's
 * actually not too terrible even in an account with thousands of stacks.
 *
 * @param {String} stackBaseName The base name of the stack, for matching.
 * @param {String} createdStackId The currently created stack, not to be
 *   included in this list.
 * @param {Object} config The configuration.
 * @param {Function} callback Of the form function (error).
 */
exports.describePriorStacks = function (stackBaseName, createdStackId, config, callback) {
  exports.ensureClient(config);

  var params = {
    // Filter down to status that indicates a running stack not involved in some
    // form of update or delete.
    StackStatusFilter: exports.stackStatusFilter
  };
  var stackSummaries = [];
  var stackDescriptions = [];

  function recurse () {
    exports.client.listStacks(params, function (error, result) {
      if (error) {
        return callback(new Error(util.format(
          'Call to describeStacks failed: %s',
          error
        )));
      }

      // Filter down to only those stacks with similar stack names, where the
      // baseName component is the same.
      stackSummaries = stackSummaries.concat(_.filter(
        result.StackSummaries,
        function (stackSummary) {
          // Match on the name, but exclude the freshly created stack.
          return utilities.baseNameMatchesStackName(
            stackBaseName,
            stackSummary.StackName
          ) && stackSummary.StackId !== createdStackId;
        }
      ));

      // If there are too many stack summaries to get at one go, then fetch
      // the next page.
      if (result.NextToken) {
        params.NextToken = result.NextToken;
        return recurse();
      }

      if (!stackSummaries.length) {
        return callback(null, stackDescriptions);
      }

      // Now fetch a description for each of the near-match summaries. This is
      // done in series just in case there are a hundred of them. The standard
      // situation is that there will be one, or at most two if there have been
      // deployment failures.
      //
      // Check the tags to make sure that each is actually a prior stack.
      async.eachSeries(stackSummaries, function (stackSummary, asyncCallback) {
        exports.describeStack(
          stackSummary.StackId,
          config,
          function (describeStackError, stackDescription) {
            if (describeStackError) {
              return asyncCallback(describeStackError);
            }

            var isPriorStack = _.some(stackDescription.Tags, function (tag) {
              // Depends on the order of properties, but that should be ok.
              return JSON.stringify(tag) === JSON.stringify({
                Key: constants.tag.STACK_BASE_NAME,
                Value: stackBaseName
              });
            });

            if (isPriorStack) {
              stackDescriptions.push(stackDescription);
            }

            asyncCallback();
          }
        );
      }, function (asyncError) {
        callback(asyncError, stackDescriptions);
      });
    });
  }

  recurse();
};

/**
 * Request information on a stack.
 *
 * Returns events in chronological order.
 *
 * @param {String} stackId The stack ID.
 * @param {Object} config The configuration.
 * @param {Function} callback Of the form function (error, object[]).
 */
exports.describeStackEvents = function (stackId, config, callback) {
  exports.ensureClient(config);

  var params = {
    StackName: stackId
  };
  var events = [];

  function recurse () {
    exports.client.describeStackEvents(params, function (error, result) {
      if (error) {
        return callback(new Error(util.format(
          'Call to describeStackEvents failed: %s',
          error
        )));
      }

      events = events.concat(result.StackEvents);

      // This shouldn't happen for most stacks, but if there are too many
      // events to get at one go, then fetch the next page.
      if (result.NextToken) {
        params.NextToken = result.NextToken;
        return recurse();
      }

      // Events arrive in reverse chronological order, but that's inconvenient
      // for the sort of processing we want to carry out, so reverse it.
      callback(null, events.reverse());
    });
  }

  recurse();
};

/**
 * Validate a CloudFormation template.
 *
 * @param {Object|String} template Either an object, JSON, or a URL.
 * @param {Object} config The configuration.
 * @param {Function} callback Of the form function (error).
 */
exports.validateTemplate = function (template, config, callback) {
  exports.ensureClient(config);

  var params = {};

  utilities.addTemplatePropertyToParameters(params, template);
  exports.client.validateTemplate(params, function (error) {
    if (error) {
      return callback(new Error(util.format(
        'Call to validateTemplate failed: %s',
        error
      )));
    }

    callback();
  });
};
