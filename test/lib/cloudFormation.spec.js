/**
 * @fileOverview Tests for CloudFormation utilities.
 */

// NPM.
var AWS = require('aws-sdk');

// Local.
var CloudFormation = require('../../lib/cloudFormation');
var constants = require('../../lib/constants');
var resources = require('../resources');
var utilities = require('../../lib/utilities');

describe('lib/cloudFormation', function () {
  var cloudFormation;
  var config;
  var sandbox;
  var template;

  beforeEach(function () {
    config = resources.getConfig();
    sandbox = sinon.sandbox.create();
    template = JSON.stringify({});

    cloudFormation = new CloudFormation(config);

    // Make sure we stub everything that is used.
    sandbox.stub(cloudFormation.client, 'createStack').yields(null, {
      StackId: ''
    });
    sandbox.stub(cloudFormation.client, 'deleteStack').yields();
    sandbox.stub(cloudFormation.client, 'describeStacks').yields(null, {
      Stacks: [{}]
    });
    sandbox.stub(cloudFormation.client, 'describeStackEvents').yields(null, {
      StackEvents: []
    });
    sandbox.stub(cloudFormation.client, 'listStacks').yields(null, [{}]);
    sandbox.stub(cloudFormation.client, 'validateTemplate').yields();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('client', function () {
    it('creates a client with implicit configuration', function () {
      expect(cloudFormation.client).to.be.instanceOf(AWS.CloudFormation);
    });

    it('creates a client with explicit configuration', function () {
      sandbox.spy(AWS, 'CloudFormation');
      config.clientOptions = {
        region: 'eu-west-1'
      };
      cloudFormation = new CloudFormation(config);
      sinon.assert.calledWith(AWS.CloudFormation, config.clientOptions);
    });
  });

  describe('createStack', function () {
    it('invokes createStack with expected arguments', function (done) {
      cloudFormation.createStack(template, function (error, data) {
        sinon.assert.calledWith(
          cloudFormation.client.createStack,
          {
            StackName: utilities.getStackName(config),
            Capabilities: ['CAPABILITY_IAM'],
            OnFailure: config.onFailure,
            Parameters: utilities.getParameters(config),
            Tags: utilities.getTags(config),
            TemplateBody: template,
            TimeoutInMinutes: config.createStackTimeoutInMinutes
          },
          sinon.match.func
        );

        expect(data).to.eql({
          StackId: ''
        });

        done(error);
      });
    });
  });

  describe('deleteStack', function () {
    it('invokes deleteStack with expected arguments', function (done) {
      var stackId = '';
      cloudFormation.deleteStack(stackId, function (error) {
        sinon.assert.calledWith(
          cloudFormation.client.deleteStack,
          {
            StackName: stackId
          },
          sinon.match.func
        );

        done(error);
      });
    });
  });

  describe('describeStack', function () {
    it('invokes describeStacks with expected arguments', function (done) {
      var stackId = '';

      cloudFormation.describeStack(stackId, function (error, data) {
        sinon.assert.calledWith(
          cloudFormation.client.describeStacks,
          {
            StackName: stackId
          },
          sinon.match.func
        );

        expect(data).to.eql({});
        done(error);
      });
    });

    it('calls back with error if empty stacks array returned', function (done) {
      var stackId = '';
      cloudFormation.client.describeStacks.yields(null, {
        Stacks: []
      });

      cloudFormation.describeStack(stackId, function (error, data) {
        expect(error).to.be.instanceof(Error);
        done();
      });
    });
  });

  describe('describePriorStacks', function () {
    var createdStackId = 'stackId';

    it('functions correctly when no stacks are returned from listStacks', function (done) {
      cloudFormation.describePriorStacks(
        config.baseName,
        createdStackId,
        function (error, stackDescriptions) {
          sinon.assert.calledWith(
            cloudFormation.client.listStacks,
            {
              StackStatusFilter: cloudFormation.stackStatusFilter
            },
            sinon.match.func
          );

          expect(stackDescriptions).to.eql([]);
          done(error);
        }
      );
    });

    it('makes repeated listStacks requests for NextToken', function (done) {
      var validPriorConfig = resources.getConfig({
        deployId: 'random-valid'
      });
      var invalidPriorConfig = resources.getConfig({
        deployId: 'random-invalid'
      });

      var validPriorStackSummary = {
        StackName: utilities.getStackName(validPriorConfig),
        StackId: 'priorStackId'
      };
      var invalidPriorStackSummary = {
        StackName: utilities.getStackName(invalidPriorConfig),
        StackId: 'priorStackId'
      };
      var createdStackSummary = {
        StackName: utilities.getStackName(config),
        StackId: createdStackId
      };

      var validPriorStackDescription = {
        Tags: [
          {
            Key: constants.tag.STACK_BASE_NAME,
            Value: config.baseName
          }
        ]
      };
      var invalidPriorStackDescription = {
        Tags: [
          {
            Key: constants.tag.STACK_BASE_NAME,
            Value: 'another tag value'
          }
        ]
      };

      // The client returns events in reverse chronological order.
      cloudFormation.client.listStacks.onCall(0).yields(null, {
        NextToken: 'call0',
        StackSummaries: [
          {
            StackName: 'sn-1',
            StackId: 'id-1'
          },
          validPriorStackSummary
        ]
      });
      cloudFormation.client.listStacks.onCall(1).yields(null, {
        NextToken: 'call1',
        StackSummaries: [
          invalidPriorStackSummary,
          {
            StackName: 'sn-4',
            StackId: 'id-4'
          }
        ]
      });
      cloudFormation.client.listStacks.onCall(2).yields(null, {
        StackSummaries: [
          {
            StackName: 'sn-3',
            StackId: 'id-3'
          },
          createdStackSummary
        ]
      });

      // Set this up so that only one of the two possible prior stacks has the
      // right matching tag.
      sandbox.stub(cloudFormation, 'describeStack');
      cloudFormation.describeStack.onCall(0).yields(null, validPriorStackDescription);
      cloudFormation.describeStack.onCall(1).yields(null, invalidPriorStackDescription);

      cloudFormation.describePriorStacks(
        config.baseName,
        createdStackId,
        function (error, stackDescriptions) {
          sinon.assert.callCount(cloudFormation.client.listStacks, 3);
          cloudFormation.client.listStacks.getCall(0).calledWith(
            {
              StackStatusFilter: cloudFormation.stackStatusFilter
            },
            sinon.match.func
          );
          cloudFormation.client.listStacks.getCall(1).calledWith(
            cloudFormation.client.describeStackEvents,
            {
              NextToken: 'call0',
              StackStatusFilter: cloudFormation.stackStatusFilter
            },
            sinon.match.func
          );
          cloudFormation.client.listStacks.getCall(2).calledWith(
            cloudFormation.client.describeStackEvents,
            {
              NextToken: 'call1',
              StackStatusFilter: cloudFormation.stackStatusFilter
            },
            sinon.match.func
          );

          sinon.assert.calledTwice(cloudFormation.describeStack);
          cloudFormation.describeStack.getCall(0).calledWith(
            validPriorStackSummary.StackId,
            sinon.match.func
          );
          cloudFormation.describeStack.getCall(1).calledWith(
            invalidPriorStackSummary.StackId,
            sinon.match.func
          );

          expect(stackDescriptions).to.eql([validPriorStackDescription]);

          done(error);
        }
      );
    });
  });

  describe('describeStackEvents', function () {
    it('invokes describeStackEvents with expected arguments', function (done) {
      var stackId = '';
      cloudFormation.describeStackEvents(stackId, function (error, results) {
        sinon.assert.calledWith(
          cloudFormation.client.describeStackEvents,
          {
            StackName: stackId
          },
          sinon.match.func
        );

        expect(results).to.eql([]);
        done(error);
      });
    });

    it('makes repeated requests for NextToken', function (done) {
      var stackId = '';

      // The client returns events in reverse chronological order.
      cloudFormation.client.describeStackEvents.onCall(0).yields(null, {
        NextToken: 'call0',
        StackEvents: [{ i: 6 }, { i: 5 }]
      });
      cloudFormation.client.describeStackEvents.onCall(1).yields(null, {
        NextToken: 'call1',
        StackEvents: [{ i: 4 }, { i: 3 }]
      });
      cloudFormation.client.describeStackEvents.onCall(2).yields(null, {
        StackEvents: [{ i: 2 }, { i: 1 }]
      });

      cloudFormation.describeStackEvents(stackId, function (error, results) {
        sinon.assert.callCount(cloudFormation.client.describeStackEvents, 3);
        cloudFormation.client.describeStackEvents.getCall(0).calledWith(
          {
            StackName: stackId
          },
          sinon.match.func
        );
        cloudFormation.client.describeStackEvents.getCall(1).calledWith(
          cloudFormation.client.describeStackEvents,
          {
            NextToken: 'call0',
            StackName: stackId
          },
          sinon.match.func
        );
        cloudFormation.client.describeStackEvents.getCall(2).calledWith(
          cloudFormation.client.describeStackEvents,
          {
            NextToken: 'call1',
            StackName: stackId
          },
          sinon.match.func
        );

        // Events are reversed to put them in chronological order.
        expect(results).to.eql([
          { i: 1 },
          { i: 2 },
          { i: 3 },
          { i: 4 },
          { i: 5 },
          { i: 6 }
        ]);

        done(error);
      });
    });
  });

  describe('validateTemplate', function () {
    it('invokes validateTemplate with expected arguments', function (done) {
      cloudFormation.validateTemplate(template, function (error) {
        sinon.assert.calledWith(
          cloudFormation.client.validateTemplate,
          {
            TemplateBody: template
          },
          sinon.match.func
        );

        done(error);
      });
    });
  });

});
