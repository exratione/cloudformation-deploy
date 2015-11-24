/**
 * @fileOverview Tests for the configuration validator.
 */

// Local.
var configValidator = require('../../lib/configValidator');
var constants = require('../../lib/constants');
var resources = require('../resources');

describe('lib/configValidator', function () {

  var config;
  var errors;

  function run (property, value, shouldError) {
    config = resources.getConfig();
    config[property] = value;
    errors = configValidator.validate(config);
    if (shouldError) {
      expect(errors.length).to.be.above(0);
    }
    else {
      expect(errors.length).to.equal(0);
    }
  }

  function shouldAccept (property, value) {
    run(property, value, false);
  }

  function shouldReject (property, value) {
    run(property, value, true);
  }

  it('validates correct configuration', function () {
    config = resources.getConfig();
    errors = configValidator.validate(config);
    expect(errors).to.eql([]);
  });

  it('rejects invalid configurations, accepts valid configurations', function () {
    shouldReject('baseName', undefined);
    shouldReject('baseName', '');

    shouldReject('version', undefined);
    shouldReject('version', '');

    shouldReject('deployId', undefined);
    shouldReject('deployId', '');
    shouldAccept('deployId', '7');
    shouldAccept('deployId', 7);

    shouldReject('onFailure', undefined);
    shouldReject('onFailure', '');
    shouldAccept('onFailure', constants.onFailure.DELETE);
    shouldAccept('onFailure', constants.onFailure.DO_NOTHING);

    shouldReject('parameters', undefined);
    shouldReject('parameters', { numberIsInvalid: 7 });
    shouldAccept('parameters', {});
    shouldAccept('parameters', { arbitraryName: 'value' });

    shouldReject('progressCheckIntervalInSeconds', undefined);
    shouldReject('progressCheckIntervalInSeconds', 0);
    shouldReject('progressCheckIntervalInSeconds', -1);
    shouldReject('progressCheckIntervalInSeconds', 'value');

    shouldReject('onEventFn', undefined);
    shouldReject('onEventFn', 'value');

    shouldReject('postCreationFn', undefined);
    shouldReject('postCreationFn', 'value');

    shouldReject('priorInstance', undefined);
    shouldReject('priorInstance', 'value');
    shouldAccept('priorInstance', constants.priorInstance.DELETE);
    shouldAccept('priorInstance', constants.priorInstance.DO_NOTHING);

    shouldReject('tags', undefined);
    shouldReject('tags', { numberIsInvalid: 7 });
    shouldAccept('parameters', {});
    shouldAccept('parameters', { arbitraryName: 'value' });

    shouldReject('createStackTimeoutInMinutes', undefined);
    shouldReject('createStackTimeoutInMinutes', 'value');
    shouldReject('createStackTimeoutInMinutes', -1);
    shouldAccept('createStackTimeoutInMinutes', 0);

    // The actually optional options property passed to AWS clients.
    shouldReject('clientOptions', 'value');
    shouldAccept('clientOptions', {});

    // Adding extra unwanted property.
    shouldReject('x', 'value');
  });
});
