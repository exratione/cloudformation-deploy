/**
 * @fileOverview Tests for shared utilities.
 */

// Local.
var constants = require('../../lib/constants');
var resources = require('../resources');
var utilities = require('../../lib/utilities');

describe('lib/utilities.js', function () {

  var config;

  beforeEach(function () {
    config = resources.getConfig();
  });

  describe('getStackName', function () {
    it('functions correctly', function () {
      expect(utilities.getStackName(config)).to.equal(
        config.baseName + '-' + config.deployId
      );
    });

    it('replaces invalid characters with dashes', function () {
      config.baseName = '._%a';
      config.deployId = '._%b';

      expect(utilities.getStackName(config)).to.equal('---a----b');
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
      expect(utilities.getParameters(config)).to.eql([
        {
          ParameterKey: 'name',
          ParameterValue: 'value'
        }
      ]);
    });

    it('functions correctly for missing parameters', function () {
      config.parameters = undefined;
      expect(utilities.getParameters(config)).to.eql([]);
    });
  });

  describe('getTags', function () {
    it('functions correctly', function () {
      expect(utilities.getTags(config)).to.eql([
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

    it('functions correctly for missing tags', function () {
      config.tags = undefined;
      expect(utilities.getTags(config)).to.eql([
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

  describe('fillConfigurationDefaults', function () {
    it('fills defaults', function () {
      var configA = utilities.fillConfigurationDefaults({
        baseName: 'test',
        version: '1.0.0',
        deployId: '1'
      });
      var configB = {
        clientOptions: undefined,
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
        onFailure: constants.onFailure.DELETE
      };

      // Comparing functions, have to take account of different indentations.
      configA.onEventFn = configA.onEventFn.toString().replace(/\s+/g, ' ');
      configB.onEventFn = configB.onEventFn.toString().replace(/\s+/g, ' ');
      configA.postCreationFn = configA.postCreationFn.toString().replace(/\s+/g, ' ');
      configB.postCreationFn = configB.postCreationFn.toString().replace(/\s+/g, ' ');

      expect(configA).to.eql(configB);
    });

    it('does not override values', function () {
      config = {
        clientOptions: undefined,
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
        onFailure: constants.onFailure.DO_NOTHING
      };

      expect(utilities.fillConfigurationDefaults(config)).to.eql(config);
    });
  });

});
