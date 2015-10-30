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

var configSchema = {
  id: '/Config',
  type: 'object',
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

    onFailure: {
      enum: _.values(constants.onFailure),
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

    progressCheckIntervalInSeconds: {
      type: 'number',
      minimum: 1,
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

    createStackTimeoutInMinutes: {
      type: 'number',
      minimum: 0,
      required: true
    }
  },
  required: true
};


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
 * Validate the provided configuration.
 *
 * @param {Object} config Configuration.
 * @return {Error[]} An array of errors.
 */
exports.validate = function (config) {
  var result = validator.validate(config, configSchema) || {};
  return result.errors || [];
};
