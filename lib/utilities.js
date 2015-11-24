/**
 * @fileOverview Various utility functions.
 */

// NPM.
var _ = require('lodash');

// Local.
var constants = require('./constants');

/**
 * Obtain the stack name.
 *
 * @param {Object} config Configuration.
 * @return {String} The stack name.
 */
exports.getStackName = function (config) {
  // All invalid characters are replaced with dashes.
  var stackName = config.baseName + '-' + config.deployId;
  return stackName.replace(/[^\-a-z0-9]/ig, '-');
};

/**
 * Does this baseName match the baseName portion of this stackName?
 *
 * @param {String} baseName A base name.
 * @param {String} stackName A stack name.
 * @return {Boolean} True if there is a match.
 */
exports.baseNameMatchesStackName = function (baseName, stackName) {
  return stackName.indexOf(baseName + '-') === 0;
};

/**
 * Get an array of parameter definitions suitable for use with the AWS-SDK
 * client.
 *
 * @param {Object} config Configuration.
 * @param {Object[]} Array of parameter definitions.
 */
exports.getParameters = function (config) {
  return _.map(config.parameters, function (value, key) {
    return {
      ParameterKey: key,
      ParameterValue: value
    };
  });
};

/**
 * Get an array of tag definitions suitable for use with the AWS-SDK client.
 *
 * @param {Object} config Configuration.
 * @param {Object[]} Array of tag definitions.
 */
exports.getTags = function (config) {
  var tags = _.map(config.tags, function (value, key) {
    return {
      Key: key,
      Value: value
    };
  });

  tags.push({
    Key: constants.tag.STACK_NAME,
    Value: exports.getStackName(config)
  });

  tags.push({
    Key: constants.tag.STACK_BASE_NAME,
    Value: config.baseName
  });

  if (config.version) {
    tags.push({
      Key: constants.tag.VERSION,
      Value: config.version
    });
  }

  return tags;
};

/**
 * Given a parameters object for a CloudFormation request, add either a
 * TemplateURL or TemplateBody property depending on what has been passed as the
 * template.
 *
 * @param {Object} params Parameters object.
 * @param {Object|String} template Either an object, JSON, or a URL.
 */
exports.addTemplatePropertyToParameters = function (params, template) {
  if (typeof template === 'string') {
    // Is the template a url?
    if (template.match(/^https?:\/\/.+/)) {
      params.TemplateURL = template;
    }
    else {
      params.TemplateBody = template;
    }
  }
  else {
    params.TemplateBody = JSON.stringify(template);
  }
};

/**
 * Fill out the configuration object with default values.
 *
 * @param {Object} config Configuration.
 * @param {Object} Configuration with defaults set.
 */
exports.fillConfigurationDefaults = function (config) {
  return _.defaults(config, {
    clientOptions: undefined,
    createStackTimeoutInMinutes: 10,
    tags: {},
    parameters: {},
    progressCheckIntervalInSeconds: 10,
    onEventFn: function () {},
    postCreationFn: function (stackDescription, callback) {
      callback();
    },
    priorInstance: constants.priorInstance.DELETE,
    onFailure: constants.onFailure.DELETE
  });
};
