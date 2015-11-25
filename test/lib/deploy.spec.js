/**
 * @fileOverview Tests for the top level deployment code.
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

    config = resources.getConfig();
    template = JSON.stringify({});
    deploy = new Deploy(config, template);
    stackId = 'id';
    result = {
      timedOut: false,
      errors: [],
      createStack: deploy.getStackData(utilities.getStackName(config)),
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

  describe('updateEventData', function () {
    var dummyOldEvent;
    var dummyNewEvent;
    var oldEvents;
    var newEvents;
    var events;

    beforeEach(function () {
      dummyOldEvent = {
        ResourceType: 'old',
        ResourceStatus: 'old'
      };
      dummyNewEvent = {
        ResourceType: 'new',
        ResourceStatus: 'new'
      };

      oldEvents = [dummyOldEvent, dummyOldEvent];

      result.createStack.stackId = stackId;
      result.createStack.events = oldEvents;
    });

    it('functions correctly', function (done) {
      newEvents = [
        dummyNewEvent,
        {
          ResourceType: constants.resourceType.STACK,
          ResourceStatus: constants.resourceStatus.CREATE_COMPLETE
        },
        dummyNewEvent
      ];
      events = oldEvents.concat(newEvents);

      deploy.cloudFormation.describeStackEvents.yields(null, events);

      deploy.updateEventData(result.createStack, function (error) {
        sinon.assert.calledWith(
          deploy.cloudFormation.describeStackEvents,
          result.createStack.stackId,
          sinon.match.func
        );

        // Each new event should trigger a call to the callback function for
        // events.
        sinon.assert.callCount(config.onEventFn, newEvents.length);
        config.onEventFn.getCall(0).calledWith(newEvents[0]);
        config.onEventFn.getCall(1).calledWith(newEvents[1]);
        config.onEventFn.getCall(2).calledWith(newEvents[2]);

        expect(result.createStack.events).to.eql(events);
        expect(result.createStack.status).to.eql(newEvents[1].ResourceStatus);

        done(error);
      });
    });

    it('functions correctly with stack event last', function (done) {
      newEvents = [
        dummyNewEvent,
        {
          ResourceType: constants.resourceType.STACK,
          ResourceStatus: constants.resourceStatus.CREATE_COMPLETE
        }
      ];
      events = oldEvents.concat(newEvents);

      deploy.cloudFormation.describeStackEvents.yields(null, events);

      deploy.updateEventData(result.createStack, function (error) {
        sinon.assert.calledWith(
          deploy.cloudFormation.describeStackEvents,
          result.createStack.stackId,
          sinon.match.func
        );

        // Each new event should trigger a call to the callback function for
        // events.
        sinon.assert.callCount(config.onEventFn, newEvents.length);
        config.onEventFn.getCall(0).calledWith(newEvents[0]);
        config.onEventFn.getCall(1).calledWith(newEvents[1]);

        expect(result.createStack.events).to.eql(events);
        expect(result.createStack.status).to.eql(newEvents[1].ResourceStatus);

        done(error);
      });
    });

    it('functions correctly with no stack event', function (done) {
      newEvents = [
        dummyNewEvent
      ];
      events = oldEvents.concat(newEvents);

      deploy.cloudFormation.describeStackEvents.yields(null, events);

      deploy.updateEventData(result.createStack, function (error) {
        sinon.assert.calledWith(
          deploy.cloudFormation.describeStackEvents,
          result.createStack.stackId,
          sinon.match.func
        );

        // Each new event should trigger a call to the callback function for
        // events.
        sinon.assert.callCount(config.onEventFn, newEvents.length);
        config.onEventFn.getCall(0).calledWith(newEvents[0]);

        expect(result.createStack.events).to.eql(events);
        expect(result.createStack.status).to.equal(undefined);

        done(error);
      });
    });

    it('calls back with error on error', function (done) {
      deploy.cloudFormation.describeStackEvents.yields(new Error());

      deploy.updateEventData(result.createStack, function (error) {
        expect(error).to.be.instanceof(Error);
        done();
      });
    });

  });

  describe('awaitCompletion', function () {
    var clock;
    var calledBack;

    beforeEach(function () {
      clock = sandbox.useFakeTimers();
      calledBack = false;

      sandbox.stub(deploy, 'updateEventData').yields();
    });

    function run (type, setStatus, shouldError) {
      deploy.awaitCompletion(
        type,
        result.createStack,
        function (error) {
          if (shouldError) {
            expect(error).to.be.instanceof(Error);
          }
          else {
            expect(error).to.equal(undefined);
          }
          calledBack = true;
        }
      );

      // It should loop the first time since the condition isn't satisfied.
      clock.tick(config.progressCheckIntervalInSeconds * 1000);
      expect(result.createStack.status).to.equal(undefined);
      sinon.assert.calledOnce(deploy.updateEventData);
      sinon.assert.calledWith(
        deploy.updateEventData,
        result.createStack,
        sinon.match.func
      );
      expect(calledBack).to.equal(false);

      // Now set the result and that should result in completion.
      result.createStack.status = setStatus;
      clock.tick(config.progressCheckIntervalInSeconds * 1000);
      sinon.assert.calledTwice(deploy.updateEventData);
      sinon.assert.calledWith(
        deploy.updateEventData,
        result.createStack,
        sinon.match.func
      );
      expect(calledBack).to.equal(true);
    }

    it('CREATE_STACK completes on resourceStatus.CREATE_COMPLETE', function () {
      config.onFailure = constants.onFailure.DELETE;
      run(
        constants.type.CREATE_STACK,
        constants.resourceStatus.CREATE_COMPLETE,
        false
      );
    });

    // Delete complete should produce an error even if successful to break out
    // of the flow of tasks and finish up.
    it('CREATE_STACK errors on resourceStatus.DELETE_COMPLETE', function () {
      config.onFailure = constants.onFailure.DELETE;
      run(
        constants.type.CREATE_STACK,
        constants.resourceStatus.DELETE_COMPLETE,
        true
      );
    });

    it('CREATE_STACK errors on resourceStatus.DELETE_FAILED', function () {
      config.onFailure = constants.onFailure.DELETE;
      run(
        constants.type.CREATE_STACK,
        constants.resourceStatus.DELETE_FAILED,
        true
      );
    });

    it('CREATE_STACK completes on resourceStatus.CREATE_FAILED when not deleting stack', function () {
      config.onFailure = constants.onFailure.DO_NOTHING;
      run(
        constants.type.CREATE_STACK,
        constants.resourceStatus.CREATE_COMPLETE,
        false
      );
    });

    it('CREATE_STACK errors on resourceStatus.CREATE_FAILED when not deleting stack', function () {
      config.onFailure = constants.onFailure.DO_NOTHING;
      run(
        constants.type.CREATE_STACK,
        constants.resourceStatus.CREATE_FAILED,
        true
      );
    });

    it('DELETE_STACK completes on resourceStatus.DELETE_COMPLETE', function () {
      run(
        constants.type.DELETE_STACK,
        constants.resourceStatus.DELETE_COMPLETE,
        false
      );
    });

    it('DELETE_STACK errors on resourceStatus.DELETE_FAILED', function () {
      run(
        constants.type.DELETE_STACK,
        constants.resourceStatus.DELETE_FAILED,
        true
      );
    });
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
            utilities.getStackName(config),
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
