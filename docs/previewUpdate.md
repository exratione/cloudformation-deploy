# Preview the Update of a CloudFormation Stack

The [Change Set functionality][1] makes it possible to explore the consequences
of an update before trying it out for real, at least to some degree. There are
certainly many ways to create an update that a Change Set will declare useful,
but that will nonetheless fail horribly in reality.

## Amend the CloudFormation Template

Edit the CloudFormation template originally used to create the stack, to make
the necessary changes. It is also possible to run an update in which only the
parameters passed to the template change. This module can accept the template as
either a JSON string, an object, or a URL to a template uploaded to S3. Use the
latter method for larger templates, as it has a larger maximum size limit.

## Run the Preview

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

  // The name of the Change Set to be created.
  changeSetName: 'example-stack-15-changeset-1',

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

  // If true, delete the Change Set after obtaining the information it provides.
  deleteChangeSet: true
};

cloudFormationDeploy.previewUpdate(config, template, function (error, results) {
  if (error) {
    console.error(error);
  }

  // Whether or not there is an error, the results object is returned. It will
  // usually have additional useful information, including the details of the
  // proposed update: which operations will occur, and whether or not the
  // update is expected to succeed or fail.
  console.log(results);
});
```

## Preview Update Configuration

The `config` object passed to `cloudFormationDeploy.update` supports the
following required and optional properties.

### Required Properties

`changeSetName` - `string` - The name of the Change Set to create.

`stackName` - `string` - The name of the stack to update.

### Optional Properties

`tags` - `object` - The tags to apply to the stack in addition to those created
automatically based on the `baseName`. Tag values must be strings.

`parameters` - `object` - Values to apply to the parameters in the
CloudFormation template. Parameter values must be strings.

`progressCheckIntervalInSeconds` - `number` - Number of seconds to wait between each
check on the progress of stack creation or deletion. Defaults to `10`.

`deleteChangeSet` - `boolean` - If true, clean up by deleting the Change Set
after obtaining its information.

## Failure Cases

Failure to create or obtain information from the Change Set will result in
`cloudFormationDeploy.previewUpdate` calling back with an error. If a Change Set
is successfully created prior to the point of failure, it will not be deleted.

[1]: http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-updating-stacks-changesets.html
