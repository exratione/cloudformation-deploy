/**
 * @fileOverview Tests for the top level cloudFormationOperationment code.
 */

// Local.
var configValidator = require('../../lib/configValidator');
var constants = require('../../lib/constants');
var CloudFormationOperation = require('../../lib/cloudFormationOperation');
var resources = require('../resources');
var utilities = require('../../lib/utilities');

describe('lib/cloudFormationOperation', function () {
  var config;
  var template;
  var sandbox;
  var stackData;
  var stackId;
  var stackName;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    config = resources.getDeployConfig();
    template = JSON.stringify({});
    cloudFormationOperation = new CloudFormationOperation(config, template);
    stackId = 'id';
    stackName = 'name';

    stackData = cloudFormationOperation.getStackData(stackName, stackId);

    // Stub the event callback.
    sandbox.stub(config, 'onEventFn').returns();

    // Make sure we stub everything that is used.
    sandbox.stub(cloudFormationOperation.cloudFormation, 'describeStackEvents').yields(null, []);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('getStackData', function () {
    it('functions as expected', function () {
      expect(
        cloudFormationOperation.getStackData(stackName, stackId)
      ).to.eql({
        stackName: stackName,
        stackId: stackId,
        status: undefined,
        events: []
      })
    });
  })

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

      stackData.stackId = stackId;
      stackData.events = oldEvents;
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

      cloudFormationOperation.cloudFormation.describeStackEvents.yields(null, events);

      cloudFormationOperation.updateEventData(stackData, function (error) {
        sinon.assert.calledWith(
          cloudFormationOperation.cloudFormation.describeStackEvents,
          stackData.stackId,
          sinon.match.func
        );

        // Each new event should trigger a call to the callback function for
        // events.
        sinon.assert.callCount(config.onEventFn, newEvents.length);
        config.onEventFn.getCall(0).calledWith(newEvents[0]);
        config.onEventFn.getCall(1).calledWith(newEvents[1]);
        config.onEventFn.getCall(2).calledWith(newEvents[2]);

        expect(stackData.events).to.eql(events);
        expect(stackData.status).to.eql(newEvents[1].ResourceStatus);

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

      cloudFormationOperation.cloudFormation.describeStackEvents.yields(null, events);

      cloudFormationOperation.updateEventData(stackData, function (error) {
        sinon.assert.calledWith(
          cloudFormationOperation.cloudFormation.describeStackEvents,
          stackData.stackId,
          sinon.match.func
        );

        // Each new event should trigger a call to the callback function for
        // events.
        sinon.assert.callCount(config.onEventFn, newEvents.length);
        config.onEventFn.getCall(0).calledWith(newEvents[0]);
        config.onEventFn.getCall(1).calledWith(newEvents[1]);

        expect(stackData.events).to.eql(events);
        expect(stackData.status).to.eql(newEvents[1].ResourceStatus);

        done(error);
      });
    });

    it('functions correctly with no stack event', function (done) {
      newEvents = [
        dummyNewEvent
      ];
      events = oldEvents.concat(newEvents);

      cloudFormationOperation.cloudFormation.describeStackEvents.yields(null, events);

      cloudFormationOperation.updateEventData(stackData, function (error) {
        sinon.assert.calledWith(
          cloudFormationOperation.cloudFormation.describeStackEvents,
          stackData.stackId,
          sinon.match.func
        );

        // Each new event should trigger a call to the callback function for
        // events.
        sinon.assert.callCount(config.onEventFn, newEvents.length);
        config.onEventFn.getCall(0).calledWith(newEvents[0]);

        expect(stackData.events).to.eql(events);
        expect(stackData.status).to.equal(undefined);

        done(error);
      });
    });

    it('calls back with error on error', function (done) {
      cloudFormationOperation.cloudFormation.describeStackEvents.yields(new Error());

      cloudFormationOperation.updateEventData(stackData, function (error) {
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

      sandbox.stub(cloudFormationOperation, 'updateEventData').yields();
    });

    function run (type, setStatus, shouldError) {
      cloudFormationOperation.awaitCompletion(
        type,
        stackData,
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
      expect(stackData.status).to.equal(undefined);
      sinon.assert.calledOnce(cloudFormationOperation.updateEventData);
      sinon.assert.calledWith(
        cloudFormationOperation.updateEventData,
        stackData,
        sinon.match.func
      );
      expect(calledBack).to.equal(false);

      // Now set the result and that should result in completion.
      stackData.status = setStatus;
      clock.tick(config.progressCheckIntervalInSeconds * 1000);
      sinon.assert.calledTwice(cloudFormationOperation.updateEventData);
      sinon.assert.calledWith(
        cloudFormationOperation.updateEventData,
        stackData,
        sinon.match.func
      );
      expect(calledBack).to.equal(true);
    }

    it('CREATE_STACK completes on resourceStatus.CREATE_COMPLETE', function () {
      config.onDeployFailure = constants.onDeployFailure.DELETE;
      run(
        constants.type.CREATE_STACK,
        constants.resourceStatus.CREATE_COMPLETE,
        false
      );
    });

    // Delete complete should produce an error even if successful to break out
    // of the flow of tasks and finish up.
    it('CREATE_STACK errors on resourceStatus.DELETE_COMPLETE', function () {
      config.onDeployFailure = constants.onDeployFailure.DELETE;
      run(
        constants.type.CREATE_STACK,
        constants.resourceStatus.DELETE_COMPLETE,
        true
      );
    });

    it('CREATE_STACK errors on resourceStatus.DELETE_FAILED', function () {
      config.onDeployFailure = constants.onDeployFailure.DELETE;
      run(
        constants.type.CREATE_STACK,
        constants.resourceStatus.DELETE_FAILED,
        true
      );
    });

    it('CREATE_STACK completes on resourceStatus.CREATE_FAILED when not deleting stack', function () {
      config.onDeployFailure = constants.onDeployFailure.DO_NOTHING;
      run(
        constants.type.CREATE_STACK,
        constants.resourceStatus.CREATE_COMPLETE,
        false
      );
    });

    it('CREATE_STACK errors on resourceStatus.CREATE_FAILED when not deleting stack', function () {
      config.onDeployFailure = constants.onDeployFailure.DO_NOTHING;
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

    it('UPDATE_STACK completes on resourceStatus.UPDATE_COMPLETE', function () {
      run(
        constants.type.UPDATE_STACK,
        constants.resourceStatus.UPDATE_COMPLETE,
        false
      );
    });

    it('UPDATE_STACK errors on resourceStatus.UPDATE_ROLLBACK_COMPLETE', function () {
      run(
        constants.type.UPDATE_STACK,
        constants.resourceStatus.UPDATE_ROLLBACK_COMPLETE,
        true
      );
    });

    it('UPDATE_STACK errors on resourceStatus.UPDATE_ROLLBACK_FAILED', function () {
      run(
        constants.type.UPDATE_STACK,
        constants.resourceStatus.UPDATE_ROLLBACK_FAILED,
        true
      );
    });
  });
});
