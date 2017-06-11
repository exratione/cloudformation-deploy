/**
 * @fileOverview Tests for index.js
 */

// Local.
var constants = require('../lib/constants');
var Deploy = require('../lib/deploy');
var index = require('../index');
var PreviewUpdate = require('../lib/previewUpdate');
var Update = require('../lib/update');

describe('index', function () {
  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('capabilities', function () {
    it('is correctly assigned', function () {
      expect(index.capabilities).to.equal(constants.capabilities);
    });
  });

  describe('onDeployFailure', function () {
    it('is correctly assigned', function () {
      expect(index.onDeployFailure).to.equal(constants.onDeployFailure);
    });
  });

  describe('priorInstance', function () {
    it('is correctly assigned', function () {
      expect(index.priorInstance).to.equal(constants.priorInstance);
    });
  });

  describe('deploy', function () {
    var config;
    var template;

    beforeEach(function () {
      config = {};
      template = {};

      sandbox.stub(Deploy.prototype, 'deploy').yields();
    });

    it('functions as expected', function (done) {
      index.deploy(config, template, function (error) {
        sinon.assert.calledWith(
          Deploy.prototype.deploy,
          sinon.match.func
        );

        done(error);
      });
    })
  });

  describe('previewUpdate', function () {
    var config;
    var template;

    beforeEach(function () {
      config = {};
      template = {};

      sandbox.stub(PreviewUpdate.prototype, 'previewUpdate').yields();
    });

    it('functions as expected', function (done) {
      index.previewUpdate(config, template, function (error) {
        sinon.assert.calledWith(
          PreviewUpdate.prototype.previewUpdate,
          sinon.match.func
        );

        done(error);
      });
    })
  });

  describe('update', function () {
    var config;
    var template;

    beforeEach(function () {
      config = {};
      template = {};

      sandbox.stub(Update.prototype, 'update').yields();
    });

    it('functions as expected', function (done) {
      index.update(config, template, function (error) {
        sinon.assert.calledWith(
          Update.prototype.update,
          sinon.match.func
        );

        done(error);
      });
    })
  });

});
