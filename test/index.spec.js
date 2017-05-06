/**
 * @fileOverview Tests for index.js
 */

// Local.
var constants = require('../lib/constants');
var Deploy = require('../lib/deploy');
var index = require('../index');

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

  describe('onFailure', function () {
    it('is correctly assigned', function () {
      expect(index.onFailure).to.equal(constants.onFailure);
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

});
