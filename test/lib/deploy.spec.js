/**
 * @fileOverview Tests for the deploy code.
 */

// Local.
var configValidator = require('../../lib/configValidator');
var constants = require('../../lib/constants');
var Deploy = require('../../lib/deploy');
var resources = require('../resources');
var utilities = require('../../lib/utilities');

describe('lib/deploy', function () {
  var config;
  var template;
  var sandbox;
  var result;
  var stackId;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    config = resources.getDeployConfig();
    template = JSON.stringify({});
    deploy = new Deploy(config, template);
    stackId = 'id';
    result = {
      timedOut: false,
      errors: [],
      createStack: deploy.getStackData(utilities.determineStackName(config)),
      describeStack: undefined,
      deleteStack: []
    };

    // Stub the event callback.
    sandbox.stub(config, 'onEventFn').returns();

    // Make sure we stub everything that is used.
    sandbox.stub(deploy.cloudFormation, 'createStack').yields(null, {
      StackId: stackId
    });
    sandbox.stub(deploy.cloudFormation, 'deleteStack').yields();
    sandbox.stub(deploy.cloudFormation, 'describeStack').yields(null, {
      StackId: stackId
    });
    sandbox.stub(deploy.cloudFormation, 'describePriorStacks').yields(null, []);
    sandbox.stub(deploy.cloudFormation, 'describeStackEvents').yields(null, []);
    sandbox.stub(deploy.cloudFormation, 'validateTemplate').yields();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('deleteStack', function () {
    it('invokes underlying functions', function (done) {
      sandbox.stub(deploy, 'awaitCompletion').yields();

      result.createStack.stackId = stackId;

      deploy.deleteStack(result.createStack, function (error) {
        sinon.assert.callOrder(
          deploy.cloudFormation.deleteStack,
          deploy.awaitCompletion
        );
        sinon.assert.calledWith(
          deploy.cloudFormation.deleteStack,
          result.createStack.stackId,
          sinon.match.func
        );
        sinon.assert.calledWith(
          deploy.awaitCompletion,
          constants.type.DELETE_STACK,
          result.createStack,
          sinon.match.func
        );

        done(error);
      });

    });
  });

  describe('deletePriorStacks', function () {
    beforeEach(function () {
      sandbox.stub(deploy, 'deleteStack').yields();
    });

    it('deletes only matching stacks', function (done) {
      var matchingStackName = config.baseName + '-' + 'dummy';
      var matchingStackId = 'a-valid-stack-id';
      result.createStack.stackId = 'created-stack-id';

      deploy.cloudFormation.describePriorStacks.yields(null, [
        {
          StackName: matchingStackName,
          StackId: matchingStackId
        }
      ]);

      deploy.deletePriorStacks(result, function (error) {
        sinon.assert.calledWith(
          deploy.cloudFormation.describePriorStacks,
          config.baseName,
          result.createStack.stackId,
          sinon.match.func
        );
        sinon.assert.calledOnce(deploy.deleteStack);
        sinon.assert.calledWith(
          deploy.deleteStack,
          deploy.getStackData(
            matchingStackName,
            matchingStackId
          ),
          sinon.match.func
        );

        done(error);
      });
    });
  });

  describe('deploy', function () {

    beforeEach(function () {
      sandbox.stub(configValidator, 'validate').returns([]);
      sandbox.stub(deploy, 'awaitCompletion').yields();
      sandbox.stub(config, 'postCreationFn').yields();
      sandbox.stub(deploy, 'deletePriorStacks').yields();
    });

    it('invokes underlying functions when no errors are created', function (done) {
      deploy.deploy(function (error, generatedResult) {
        sinon.assert.callOrder(
          configValidator.validate,
          deploy.cloudFormation.validateTemplate,
          deploy.cloudFormation.createStack,
          deploy.awaitCompletion,
          deploy.cloudFormation.describeStack,
          config.postCreationFn,
          deploy.deletePriorStacks
        );

        sinon.assert.calledWith(
          configValidator.validate,
          config
        );
        sinon.assert.calledWith(
          deploy.cloudFormation.validateTemplate,
          template,
          sinon.match.func
        );
        sinon.assert.calledWith(
          deploy.cloudFormation.createStack,
          template,
          sinon.match.func
        );
        sinon.assert.calledWith(
          deploy.awaitCompletion,
          constants.type.CREATE_STACK,
          deploy.getStackData(
            utilities.determineStackName(config),
            stackId
          ),
          sinon.match.func
        );
        sinon.assert.calledWith(
          deploy.cloudFormation.describeStack,
          stackId,
          sinon.match.func
        );
        sinon.assert.calledWith(
          config.postCreationFn,
          generatedResult.describeStack,
          sinon.match.func
        );
        sinon.assert.calledWith(
          deploy.deletePriorStacks,
          generatedResult,
          sinon.match.func
        );

        expect(generatedResult).to.be.instanceof(Object);
        expect(generatedResult.createStack.stackId).to.equal(stackId);

        done(error);
      });
    });
  });

});
