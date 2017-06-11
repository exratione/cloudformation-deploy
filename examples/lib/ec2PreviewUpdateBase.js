/**
 * @fileOverview Supporting code for the examples.
 *
 * This previews an update of an EC2 stack from one of the example AWS
 * templates.
 *
 * First create a stack using the ec2DeploySuccess.js example, then preview an
 * update with this code.
 */

// Core.
var fs = require('fs');
var path = require('path');

// Local.
var cloudFormationDeploy = require('../../index');

/**
 * Run the deployment.
 *
 * @param {String} stackName The stack to update.
 * @param {Function} callback Of the form function (error, result).
 */
exports.run = function (stackName, callback) {
  var config = {
    // If defined, this property is passed to the AWS SDK client. It is not
    // recommended to use this approach, but instead configure the client via
    // the environment.
    // clientOptions : {
    //   accessKeyId: 'akid',
    //   secretAccessKey: 'secret',
    //   region: 'us-east-1'
    // },
    changeSetName: stackName + '-changeset',
    stackName: stackName,
    deleteChangeSet: true,
    progressCheckIntervalInSeconds: 3,
    // Parameters provided to the CloudFormation template.
    parameters: {
      // You must create an EC2 Key Pair with this name.
      KeyName: 'cloudformation-deploy-example',
      InstanceType: 'm1.small'
    }
  };

  var templatePath = path.join(__dirname, '../templates/ec2.json');
  var template = fs.readFileSync(templatePath, {
    encoding: 'utf8'
  });

  cloudFormationDeploy.previewUpdate(config, template, callback);
};
