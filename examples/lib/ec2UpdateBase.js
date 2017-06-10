/**
 * @fileOverview Supporting code for the examples.
 *
 * This updates an EC2 stack from one of the example AWS templates.
 *
 * First create a stack using the ec2DeploySuccess.js example, then update it
 * with this code.
 *
 * Depending on the instanceType specified it can be made to succeed or fail.
 * This is helpful when wanting to demonstrate behavior of the deployment code
 * on success or failure.
 *
 * Fail on: t2.micro.
 * Succeed on: t1.micro, m1.small.
 */

// Core.
var fs = require('fs');
var path = require('path');
var util = require('util');

// Local.
var cloudFormationDeploy = require('../../index');

/**
 * Run the deployment.
 *
 * @param {String} instanceType A valid EC2 instance type.
 * @param {Function} callback Of the form function (error, result).
 */
exports.run = function (stackName, instanceType, callback) {

  var unixTimestamp = Math.round((new Date()).getTime() / 1000);

  var config = {
    // If defined, this property is passed to the AWS SDK client. It is not
    // recommended to use this approach, but instead configure the client via
    // the environment.
    // clientOptions : {
    //   accessKeyId: 'akid',
    //   secretAccessKey: 'secret',
    //   region: 'us-east-1'
    // },
    stackName: stackName,
    progressCheckIntervalInSeconds: 3,
    // Parameters provided to the CloudFormation template.
    parameters: {
      // You must create an EC2 Key Pair with this name.
      KeyName: 'cloudformation-deploy-example',
      InstanceType: instanceType
    },
    // Invoked once for each new event during stack creation and deletion.
    onEventFn: function (event) {
      console.log(util.format(
        'Event: %s',
        JSON.stringify(event)
      ));
    }
  };

  var templatePath = path.join(__dirname, '../templates/ec2.json');
  var template = fs.readFileSync(templatePath, {
    encoding: 'utf8'
  });

  cloudFormationDeploy.update(config, template, callback);
};
