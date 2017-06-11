/**
 * @fileOverview Tests for shared utilities.
 */

// NPM.
var _ = require('lodash');

// Local.
var constants = require('../../lib/constants');
var resources = require('../resources');
var utilities = require('../../lib/utilities');

describe('lib/utilities', function () {

  var deployConfig;
  var updateConfig;

  beforeEach(function () {
    deployConfig = resources.getDeployConfig();
    updateConfig = resources.getUpdateConfig();
  });

  describe('getStackName', function () {
    it('functions correctly for deploy config', function () {
      expect(utilities.determineStackName(deployConfig)).to.equal(
        deployConfig.baseName + '-' + deployConfig.deployId
      );
    });

    it('functions correctly for update config', function () {
      expect(utilities.determineStackName(updateConfig)).to.equal(
        updateConfig.stackName
      );
    });

    it('replaces invalid characters with dashes', function () {
      deployConfig.baseName = '._%a';
      deployConfig.deployId = '._%b';

      expect(utilities.determineStackName(deployConfig)).to.equal('---a----b');
    });
  });

  describe('baseNameMatchesStackName', function () {
    it('functions correctly', function () {
      expect(utilities.baseNameMatchesStackName('a', 'a-b')).to.equal(true);
      expect(utilities.baseNameMatchesStackName('a', 'aa-b')).to.equal(false);
    });
  });

  describe('getParameters', function () {
    it('functions correctly', function () {
      expect(utilities.getParameters(deployConfig)).to.eql([
        {
          ParameterKey: 'name',
          ParameterValue: 'value'
        }
      ]);
    });

    it('functions correctly for missing parameters', function () {
      deployConfig.parameters = undefined;
      expect(utilities.getParameters(deployConfig)).to.eql([]);
    });
  });

  describe('getTags', function () {
    it('functions correctly for deploy config', function () {
      expect(utilities.getTags(deployConfig)).to.eql([
        {
          Key: 'a',
          Value: 'b'
        },
        {
          Key: constants.tag.STACK_NAME,
          Value: 'test-1'
        },
        {
          Key: constants.tag.STACK_BASE_NAME,
          Value: 'test'
        },
        {
          Key: constants.tag.VERSION,
          Value: '1.0.0'
        }
      ]);
    });

    it('functions correctly for update config', function () {
      expect(utilities.getTags(updateConfig)).to.eql([
        {
          Key: 'a',
          Value: 'b'
        },
        {
          Key: constants.tag.STACK_NAME,
          Value: 'test'
        }
      ]);
    });

    it('functions correctly for missing tags', function () {
      deployConfig.tags = undefined;
      expect(utilities.getTags(deployConfig)).to.eql([
        {
          Key: constants.tag.STACK_NAME,
          Value: 'test-1'
        },
        {
          Key: constants.tag.STACK_BASE_NAME,
          Value: 'test'
        },
        {
          Key: constants.tag.VERSION,
          Value: '1.0.0'
        }
      ]);
    });
  });

  describe('addTemplatePropertyToParameters', function () {
    var params;
    var template;

    beforeEach(function () {
      params = {};
    });

    it('adds TemplateURL for URL', function () {
      template = 'http://s3.amazonaws.com/bucket/example.json';
      utilities.addTemplatePropertyToParameters(params, template);

      expect(params).to.eql({
        TemplateURL: template
      });
    });

    it('adds TemplateBody for other string', function () {
      template = JSON.stringify({});
      utilities.addTemplatePropertyToParameters(params, template);

      expect(params).to.eql({
        TemplateBody: template
      });
    });

    it('adds TemplateBody for object', function () {
      template = {};
      utilities.addTemplatePropertyToParameters(params, template);

      expect(params).to.eql({
        TemplateBody: JSON.stringify(template)
      });
    });
  });

  describe('fillDeployConfigurationDefaults', function () {
    it('fills defaults', function () {
      var deployConfigA = utilities.fillDeployConfigurationDefaults({
        baseName: 'test',
        version: '1.0.0',
        deployId: '1'
      });
      var deployConfigB = {
        clientOptions: undefined,
        capabilities: _.values(constants.capabilities),
        baseName: 'test',
        version: '1.0.0',
        deployId: '1',
        tags: {},
        parameters: {},
        progressCheckIntervalInSeconds: 10,
        onEventFn: function () {},
        postCreationFn: function (stackDescription, callback) {
          callback();
        },
        createStackTimeoutInMinutes: 10,
        priorInstance: constants.priorInstance.DELETE,
        onDeployFailure: constants.onDeployFailure.DELETE
      };

      // Comparing functions, have to take account of different indentations.
      deployConfigA.onEventFn = deployConfigA.onEventFn.toString().replace(/\s+/g, ' ');
      deployConfigB.onEventFn = deployConfigB.onEventFn.toString().replace(/\s+/g, ' ');
      deployConfigA.postCreationFn = deployConfigA.postCreationFn.toString().replace(/\s+/g, ' ');
      deployConfigB.postCreationFn = deployConfigB.postCreationFn.toString().replace(/\s+/g, ' ');

      expect(deployConfigA).to.eql(deployConfigB);
    });

    it('does not override values', function () {
      deployConfig = {
        clientOptions: undefined,
        capabilities: _.values(constants.capabilities),
        baseName: 'test',
        version: '1.0.0',
        deployId: '1',
        tags: {
          x: 'y'
        },
        parameters: {
          alpha: 'beta'
        },
        progressCheckIntervalInSeconds: 15,
        onEventFn: function (event) {
          return JSON.stringify(event);
        },
        postCreationFn: function (stackDescription, callback) {
          callback(new Error());
        },
        createStackTimeoutInMinutes: 5,
        priorInstance: constants.priorInstance.DO_NOTHING,
        onDeployFailure: constants.onDeployFailure.DO_NOTHING
      };

      expect(utilities.fillDeployConfigurationDefaults(deployConfig)).to.eql(deployConfig);
    });
  });

  describe('fillPreviewUpdateConfigurationDefaults', function () {
    it('fills defaults', function () {
      var updateConfigA = utilities.fillPreviewUpdateConfigurationDefaults({
        changeSetName: 'testChangeSet',
        stackName: 'test'
      });
      var updateConfigB = {
        changeSetName: 'testChangeSet',
        clientOptions: undefined,
        capabilities: _.values(constants.capabilities),
        deleteChangeSet: true,
        stackName: 'test',
        tags: {},
        parameters: {},
        progressCheckIntervalInSeconds: 10
      };

      expect(updateConfigA).to.eql(updateConfigB);
    });

    it('does not override values', function () {
      updateConfig = {
        changeSetName: 'testChangeSet',
        clientOptions: undefined,
        capabilities: _.values(constants.capabilities),
        deleteChangeSet: false,
        stackName: 'test',
        tags: {
          x: 'y'
        },
        parameters: {
          alpha: 'beta'
        },
        progressCheckIntervalInSeconds: 15
      };

      expect(utilities.fillPreviewUpdateConfigurationDefaults(updateConfig)).to.eql(updateConfig);
    });
  });

  describe('fillUpdateConfigurationDefaults', function () {
    it('fills defaults', function () {
      var updateConfigA = utilities.fillUpdateConfigurationDefaults({
        stackName: 'test'
      });
      var updateConfigB = {
        clientOptions: undefined,
        capabilities: _.values(constants.capabilities),
        stackName: 'test',
        tags: {},
        parameters: {},
        progressCheckIntervalInSeconds: 10,
        onEventFn: function () {}
      };

      // Comparing functions, have to take account of different indentations.
      updateConfigA.onEventFn = updateConfigA.onEventFn.toString().replace(/\s+/g, ' ');
      updateConfigB.onEventFn = updateConfigB.onEventFn.toString().replace(/\s+/g, ' ');

      expect(updateConfigA).to.eql(updateConfigB);
    });

    it('does not override values', function () {
      updateConfig = {
        clientOptions: undefined,
        capabilities: _.values(constants.capabilities),
        stackName: 'test',
        tags: {
          x: 'y'
        },
        parameters: {
          alpha: 'beta'
        },
        progressCheckIntervalInSeconds: 15,
        onEventFn: function (event) {
          return JSON.stringify(event);
        }
      };

      expect(utilities.fillUpdateConfigurationDefaults(updateConfig)).to.eql(updateConfig);
    });
  });

});
