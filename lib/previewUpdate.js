/**
 * @fileOverview Main preview update class definition.
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
 * @class PreviewUpdate interface class.
 *
 * @param {Object} config Configuration object.
 * @param {Object|String} template The CloudFormation template as either an
 *   object or JSON string, or a URL to a template file in S3 in the same region
 *   as the stack will be deployed to.
 */
function PreviewUpdate (config, template) {
  PreviewUpdate.super_.call(this, config, template);
  this.config = utilities.fillPreviewUpdateConfigurationDefaults(this.config);
}
util.inherits(PreviewUpdate, CloudFormationOperation);

// -------------------------------------------------------------------------
// Methods.
// -------------------------------------------------------------------------

/**
 * Wait on the completion of a changeset creation operation. Return the
 * changeset description once done.
 *
 * @param {Function} callback Of the form function (error, data).
 */
PreviewUpdate.prototype.awaitCompletion = function (callback) {
  var self = this;
  var changeSet;

  callback = _.once(callback);

  /**
   * Which status to watch for completion depends on whether or not
   * configuration is set to delete a failed stack automatically.
   *
   * @return {Boolean} True if complete.
   */
  function isComplete () {
    if (!changeSet) {
      return false;
    }

    return _.includes([
      constants.changeSetStatus.CREATE_COMPLETE,
      constants.changeSetStatus.FAILED
    ], changeSet.Status);
  }

  async.until(
    // Truth test - continue running the next function argument until this test
    // returns true.
    isComplete,

    // Wait for the progress check interval then load the changeset.
    function (asyncCallback) {
      setTimeout(function () {
        self.cloudFormation.describeChangeSet(function (error, data) {
          changeSet = data || changeSet;
          asyncCallback(error);
        });
      }, self.config.progressCheckIntervalInSeconds * 1000);
    },

    // Once the truth test returns true, or an error is generated, then here we
    // are.
    function (error) {
      if (error) {
        return callback(error);
      }

      callback(null, changeSet);
    }
  );
};

/**
 * Preview an update of the specified CloudFormation stack.
 *
 * See the documentation for the form of the config object.
 *
 * @param {Function} callback Of the form function (error, result).
 */
PreviewUpdate.prototype.previewUpdate = function (callback) {
  var self = this;
  var result = {
    errors: [],
    changeSet: undefined
  };

  callback = _.once(callback);

  // ------------------------------------------------------------------------
  // Run the stages of the preview.
  // ------------------------------------------------------------------------

  async.series({
    // Validate the configuration we've been provided.
    validateConfig: function (asyncCallback) {
      var errors = configValidator.validatePreviewUpdateConfig(self.config);
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

    // Start creation of the changeset.
    createChangeSet: function (asyncCallback) {
      self.cloudFormation.createChangeSet(self.template, function (error, data) {
        if (error) {
          return asyncCallback(error);
        }

        asyncCallback();
      });
    },

    // Wait for the creation of the changeset to succeed or fail.
    awaitCompletion: function (asyncCallback) {
      self.awaitCompletion(function (error, changeSet) {
        result.changeSet = changeSet;
        asyncCallback(error);
      });
    },

    deleteChangeSet: function (asyncCallback) {
      if (!self.config.deleteChangeSet) {
        return asyncCallback();
      }

      self.cloudFormation.deleteChangeSet(asyncCallback);
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

module.exports = PreviewUpdate;
