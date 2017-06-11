/**
 * @fileOverview A configuration validator.
 */

// NPM.
var jsonschema = require('jsonschema');
var _ = require('lodash');

// Local.
var constants = require('./constants');

// --------------------------------------------------------------------------
// Schema definitions.
// --------------------------------------------------------------------------

// For all operations.
var sharedConfigSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {

    // ----------------------------------------------------------------------
    // Optional for the user, but we require them internally; they are set
    // as defaults prior to the check on validity.
    // ----------------------------------------------------------------------

    capabilities: {
      type: 'array',
      items: {
        enum: _.values(constants.capabilities)
      },
      required: true
    },

    parameters: {
      type: 'object',
      patternProperties: {
        '.*': {
          type: 'string',
          required: false
        }
      },
      required: true
    },

    tags: {
      type: 'object',
      patternProperties: {
        '.*': {
          type: 'string',
          required: false
        }
      },
      required: true
    },

    // ----------------------------------------------------------------------
    // Actually optional.
    // ----------------------------------------------------------------------

    clientOptions: {
      type: 'object',
      required: false
    }

  },
  required: true
};

// For deployments.
var deployConfigSchema = _.merge({}, sharedConfigSchema, {
  id: '/DeployConfig',
  additionalProperties: false,
  properties: {

    // ----------------------------------------------------------------------
    // Required.
    // ----------------------------------------------------------------------

    baseName: {
      type: 'string',
      minLength: 1,
      required: true
    },

    version: {
      type: 'string',
      minLength: 1,
      required: true
    },

    deployId: {
      anyOf: [
        {
          type: 'string',
          minLength: 1
        },
        {
          type: 'number'
        }
      ],
      required: true
    },

    // ----------------------------------------------------------------------
    // Optional for the user, but we require them internally; they are set
    // as defaults prior to the check on validity.
    // ----------------------------------------------------------------------

    onDeployFailure: {
      enum: _.values(constants.onDeployFailure),
      required: true
    },

    onEventFn: {
      isFunction: true,
      required: true
    },

    postCreationFn: {
      isFunction: true,
      required: true
    },

    priorInstance: {
      enum: _.values(constants.priorInstance),
      required: true
    },

    progressCheckIntervalInSeconds: {
      type: 'number',
      minimum: 1,
      required: true
    },

    createStackTimeoutInMinutes: {
      type: 'number',
      minimum: 0,
      required: true
    }
  }
});

// For preview of an update via a changeset.
var previewUpdateConfigSchema = _.merge({}, sharedConfigSchema, {
  id: '/previewUpdateConfig',
  additionalProperties: false,
  properties: {

    // ----------------------------------------------------------------------
    // Required.
    // ----------------------------------------------------------------------

    changeSetName: {
      type: 'string',
      minLength: 1,
      required: true
    },

    stackName: {
      type: 'string',
      minLength: 1,
      required: true
    },

    // ----------------------------------------------------------------------
    // Optional for the user, but we require them internally; they are set
    // as defaults prior to the check on validity.
    // ----------------------------------------------------------------------

    deleteChangeSet: {
      type: 'boolean',
      required: true
    },

    progressCheckIntervalInSeconds: {
      type: 'number',
      minimum: 1,
      required: true
    }
  }
});

// For stack updates.
var updateConfigSchema = _.merge({}, sharedConfigSchema, {
  id: '/UpdateConfig',
  additionalProperties: false,
  properties: {

    // ----------------------------------------------------------------------
    // Required.
    // ----------------------------------------------------------------------

    stackName: {
      type: 'string',
      minLength: 1,
      required: true
    },

    // ----------------------------------------------------------------------
    // Optional for the user, but we require them internally; they are set
    // as defaults prior to the check on validity.
    // ----------------------------------------------------------------------

    onEventFn: {
      isFunction: true,
      required: true
    },

    progressCheckIntervalInSeconds: {
      type: 'number',
      minimum: 1,
      required: true
    }
  }
});

// --------------------------------------------------------------------------
// Set up the validator.
// --------------------------------------------------------------------------

var validator = new jsonschema.Validator();

/**
 * Since jsonschema doesn't seem to test function types properly at this point
 * in time, hack in an additional test.
 */
validator.attributes.isFunction = function (instance, schema, options, ctx) {
  var result = new jsonschema.ValidatorResult(instance, schema, options, ctx);

  if (!_.isBoolean(schema.isFunction)) {
    return result;
  }

  if (schema.isFunction) {
    if ((instance !== undefined) && (typeof instance !== 'function')) {
      result.addError('Required to be a function.');
    }
  }
  else {
    if (typeof instance === 'function') {
      result.addError('Required to not be a function.');
    }
  }

  return result;
};

// --------------------------------------------------------------------------
// Exported functions.
// --------------------------------------------------------------------------

/**
 * Validate the provided configuration against the provided schema.
 *
 * @param {Object} config Configuration.
 * @return {Error[]} An array of errors.
 */
exports.validate = function (config, schema) {
  var result = validator.validate(config, schema) || {};
  return result.errors || [];
};

/**
 * Validate the provided deploy configuration.
 *
 * @param {Object} config Deploy configuration.
 * @return {Error[]} An array of errors.
 */
exports.validateDeployConfig = function (config) {
  return exports.validate(config, deployConfigSchema);
};

/**
 * Validate the provided preview update configuration.
 *
 * @param {Object} config Update configuration.
 * @return {Error[]} An array of errors.
 */
exports.validatePreviewUpdateConfig = function (config) {
  return exports.validate(config, previewUpdateConfigSchema);
};

/**
 * Validate the provided update configuration.
 *
 * @param {Object} config Update configuration.
 * @return {Error[]} An array of errors.
 */
exports.validateUpdateConfig = function (config) {
  return exports.validate(config, updateConfigSchema);
};
