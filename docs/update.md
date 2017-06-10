# Updating a CloudFormation Stack

Updating an existing stack is fairly easy, assuming that you understand exactly
what will happen beforehand. It is a very good idea to use the
[Change Set functionality][1] to explore the consequences of an update before
trying it out for real.

## Amend the CloudFormation Template

Edit the CloudFormation template originally used to create the stack, to make
the necessary changes. It is also possible to run an update in which only the
parameters passed to the template change. This module can accept the template as
either a JSON string, an object, or a URL to a template uploaded to S3. Use the
latter method for larger templates, as it has a larger maximum size limit.

## Run the Update

Run the following code.

```js
cloudFormationDeploy = require('cloudformation-deploy');

// Pull in the CloudFormation template from a JSON file or object.
//var template = fs.readFileSync('example.json', { encoding: 'utf8' });
//var template = { ... };
// Or specify a URL.
var template = 'http://s3.amazonaws.com/bucket/example.json';

var config = {
  // --------------------
  // Required properties.
  // --------------------

  // The name of the stack to be updated.
  stackName: 'example-stack-15',

  // --------------------
  // Optional properties.
  // --------------------

  // If defined, this property is passed to the AWS SDK client. It is not
  // recommended to use this approach, see above for comments on configuring
  // AWS access via the environment.
  // clientOptions: {
  //   accessKeyId: 'akid',
  //   secretAccessKey: 'secret',
  //   region: 'us-east-1'
  // },

  // Needed for stacks that affect permissions, which is most application stacks
  // these days.
  // See: http://docs.aws.amazon.com/AWSCloudFormation/latest/APIReference/API_CreateStack.html
  capabilities: [
    cloudFormationDeploy.capabilities.CAPABILITY_IAM,
    cloudFormationDeploy.capabilities.CAPABILITY_NAMED_IAM
  ],

  // Specify additional tags to apply to the stack.
  tags: {
    name: 'value'
  },

  // Pass in any parameters required by the template.
  parameters: {
    name: 'value'
  },

  // Seconds to wait between each check on the progress of stack creation or
  // deletion.
  progressCheckIntervalInSeconds: 10,

  // A function invoked whenever a CloudFormation event is created during
  // stack creation or deletion.
  onEventFn: function (event) {
    console.log(event);
  }
};

cloudFormationDeploy.update(config, template, function (error, results) {
  if (error) {
    console.error(error);
  }

  // Whether or not there is an error, the results object is returned. It will
  // usually have additional useful information on why the stack deployment
  // failed. On success it will include the stack description, outputs
  // defined in the CloudFormation template, and events.
  console.log(results);
});
```

## Update Configuration

The `config` object passed to `cloudFormationDeploy.update` supports the
following required and optional properties.

### Required Properties

`stackName` - `string` - The name of the stack to update.

### Optional Properties

`tags` - `object` - The tags to apply to the stack in addition to those created
automatically based on the `baseName`. Tag values must be strings.

`parameters` - `object` - Values to apply to the parameters in the
CloudFormation template. Parameter values must be strings.

`progressCheckIntervalInSeconds` - `number` - Number of seconds to wait between each
check on the progress of stack creation or deletion. Defaults to `10`.

`onEventFn` - `function` - A function invoked whenever a new event is
created during stack creation or deletion.

```
function (event) {
  console.log(event);
}
```

## Failure Cases

All failure cases will result in `cloudFormationDeploy.update` calling back with
an error. The stack will attempt to roll back to its state prior to the update,
which will either succeed or fail depending on the details of the update. In
either case, the error message returned should identify the outcome and point to
the root of the problem.

[1]: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-updating-stacks-changesets.html
