/**
 * @fileOverview Tests for the update preview code.
 */

// Local.
var configValidator = require('../../lib/configValidator');
var constants = require('../../lib/constants');
var resources = require('../resources');
var PreviewUpdate = require('../../lib/previewUpdate');

describe('lib/deploy', function () {
  var completeChangeSet;
  var config;
  var incompleteChangeSet;
  var template;
  var sandbox;
  var previewUpdate;
  var result;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    config = resources.getPreviewUpdateConfig();
    template = JSON.stringify({});
    previewUpdate = new PreviewUpdate(config, template);


    completeChangeSet = {
      Status: constants.changeSetStatus.CREATE_COMPLETE
    };
    incompleteChangeSet = {
      Status: ''
    };

    result = {
      errors: [],
      changeSet: completeChangeSet
    };

    // Make sure we stub everything that is used.
    sandbox.stub(previewUpdate.cloudFormation, 'createChangeSet').yields();
    sandbox.stub(previewUpdate.cloudFormation, 'deleteChangeSet').yields();
    sandbox.stub(previewUpdate.cloudFormation, 'describeChangeSet').yields();
    sandbox.stub(previewUpdate.cloudFormation, 'validateTemplate').yields();

    previewUpdate.cloudFormation.describeChangeSet.onCall(0).yields(
      null,
      incompleteChangeSet
    );
    previewUpdate.cloudFormation.describeChangeSet.onCall(1).yields(
      null,
      completeChangeSet
    );
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('awaitCompletion', function () {
    var clock;
    var calledBack;

    beforeEach(function () {
      clock = sandbox.useFakeTimers();
      calledBack = false;
    });

    function run (setStatus) {
      previewUpdate.awaitCompletion(function (error, changeSet) {
        calledBack = true;
        expect(error).to.equal(null);
        expect(changeSet).to.eql(completeChangeSet);
      });

      // It should loop the first time since the condition isn't satisfied.
      clock.tick(config.progressCheckIntervalInSeconds * 1000);
      sinon.assert.calledOnce(previewUpdate.cloudFormation.describeChangeSet);
      sinon.assert.calledWith(
        previewUpdate.cloudFormation.describeChangeSet,
        sinon.match.func
      );
      expect(calledBack).to.equal(false);

      // Now it should result in completion.
      clock.tick(config.progressCheckIntervalInSeconds * 1000);
      sinon.assert.calledTwice(previewUpdate.cloudFormation.describeChangeSet);
      sinon.assert.calledWith(
        previewUpdate.cloudFormation.describeChangeSet,
        sinon.match.func
      );
      expect(calledBack).to.equal(true);
    }

    it('completes on CREATE_COMPLETE', function () {
      run(constants.changeSetStatus.CREATE_COMPLETE);
    });

    it('completes on FAILED', function () {
      run(constants.changeSetStatus.FAILED);
    });
  });

  describe('previewUpdate', function () {

    beforeEach(function () {
      sandbox.stub(configValidator, 'validate').returns([]);
      sandbox.stub(previewUpdate, 'awaitCompletion').yields(
        null,
        completeChangeSet
      );
    });

    it('invokes underlying functions when no errors are created', function (done) {
      previewUpdate.previewUpdate(function (error, generatedResult) {
        sinon.assert.callOrder(
          configValidator.validate,
          previewUpdate.cloudFormation.validateTemplate,
          previewUpdate.cloudFormation.createChangeSet,
          previewUpdate.awaitCompletion,
          previewUpdate.cloudFormation.deleteChangeSet
        );

        sinon.assert.calledWith(
          configValidator.validate,
          config
        );
        sinon.assert.calledWith(
          previewUpdate.cloudFormation.validateTemplate,
          template,
          sinon.match.func
        );
        sinon.assert.calledWith(
          previewUpdate.cloudFormation.createChangeSet,
          template,
          sinon.match.func
        );
        sinon.assert.calledWith(
          previewUpdate.awaitCompletion,
          sinon.match.func
        );
        sinon.assert.calledWith(
          previewUpdate.cloudFormation.deleteChangeSet,
          sinon.match.func
        );

        expect(generatedResult).to.eql(result);

        done(error);
      });
    });
  });

});
