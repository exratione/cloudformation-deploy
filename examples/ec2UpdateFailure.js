/* eslint no-extend-native: 0 */
/**
 * @fileOverview An example use of the module.
 *
 * This attempts to update a simple EC2 stack using one of the simple AWS
 * example templates. It will fail and roll back.
 *
 * To run:
 *
 * node examples/ec2DeployFailure.js <stackName>
 *
 * Before running you must use ec2DeploySuccess.js to create a stack, and take
 * note of the stack name, to supply to this script.
 */

var util = require('util');
var example = require('./lib/ec2UpdateBase');

if (process.argv.length < 3) {
  console.error('You must provide a stackName argument.');
  process.exit(1);
}

var stackName = process.argv[2];

// The deployment fails because this instance type requires deployment in a VPC.
example.run(stackName, 't2.micro', function (error, result) {
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
    console.error('Update failed.');
  }
  else {
    console.log('Update successful.');
  }
});
