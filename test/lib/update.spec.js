/**
 * @fileOverview Tests for the top level deployment code.
 */

// Local.
var configValidator = require('../../lib/configValidator');
var constants = require('../../lib/constants');
var resources = require('../resources');
var Update = require('../../lib/update');
var utilities = require('../../lib/utilities');

describe('lib/deploy', function () {
  var config;
  var template;
  var sandbox;
  var result;
  var stackId;
  var update;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    config = resources.getUpdateConfig();
    template = JSON.stringify({});
    update = new Update(config, template);
    stackId = 'id';
    result = {
      timedOut: false,
      errors: [],
      updateStack: update.getStackData(utilities.determineStackName(config)),
      describeStack: undefined
    };

    // Stub the event callback.
    sandbox.stub(config, 'onEventFn').returns();

    // Make sure we stub everything that is used.
    sandbox.stub(update.cloudFormation, 'updateStack').yields(null, {
      StackId: stackId
    });
    sandbox.stub(update.cloudFormation, 'describeStack').yields(null, {
      StackId: stackId
    });
    sandbox.stub(update.cloudFormation, 'describeStackEvents').yields(null, []);
    sandbox.stub(update.cloudFormation, 'validateTemplate').yields();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('update', function () {

    beforeEach(function () {
      sandbox.stub(configValidator, 'validate').returns([]);
      sandbox.stub(update, 'awaitCompletion').yields();
    });

    it('invokes underlying functions when no errors are created', function (done) {
      update.update(function (error, generatedResult) {
        sinon.assert.callOrder(
          configValidator.validate,
          update.cloudFormation.validateTemplate,
          update.cloudFormation.updateStack,
          update.awaitCompletion,
          update.cloudFormation.describeStack
        );

        sinon.assert.calledWith(
          configValidator.validate,
          config
        );
        sinon.assert.calledWith(
          update.cloudFormation.validateTemplate,
          template,
          sinon.match.func
        );
        sinon.assert.calledWith(
          update.cloudFormation.updateStack,
          template,
          sinon.match.func
        );
        sinon.assert.calledWith(
          update.awaitCompletion,
          constants.type.UPDATE_STACK,
          update.getStackData(
            utilities.determineStackName(config),
            stackId
          ),
          sinon.match.func
        );
        sinon.assert.calledWith(
          update.cloudFormation.describeStack,
          stackId,
          sinon.match.func
        );

        expect(generatedResult).to.be.instanceof(Object);
        expect(generatedResult.updateStack.stackId).to.equal(stackId);

        done(error);
      });
    });
  });
});
