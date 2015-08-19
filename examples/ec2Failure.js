/* eslint no-extend-native: 0 */
/**
 * @fileOverview An example use of the module.
 *
 * This attempts to deploy a simple EC2 stack using one of the simple AWS
 * example templates. It will fail and delete the stack it was trying to create.
 *
 * To run:
 *
 * node examples/ec2Failure.js
 *
 * Before running you must:
 *
 * 1) Set up suitable AWS credentials in the local environment beforehand. Read
 * the documentation for more on this topic.
 *
 * 2) Create an EC2 key pair called cloudformation-deploy-example, or change the
 * parameters.KeyName value to an existing key pair.
 */

var util = require('util');
var example = require('./lib/ec2Base');

// The deployment fails because this instance type doesn't support the required
// form of virtualization for the specified image.
example.run('t2.micro', function (error, result) {
  // This enables error messages to show up in the JSON output. Not something to
  // be used outside of example code.
  Object.defineProperty(Error.prototype, 'message', {
    configurable: true,
    enumerable: true
  });

  // This will be a large set of data even for smaller deployments.
  console.log(util.format(
    'Result: %s',
    JSON.stringify(result, null, '  ')
  ));

  if (error) {
    console.error(error.message, error.stack || '');
    console.error('Deployment failed.');
  }
  else {
    console.log('Deployment successful.');
  }
});
