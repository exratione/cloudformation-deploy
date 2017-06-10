# Configuring AWS Credentials

For deployment to work, suitable credentials for the destination AWS account
must be present. The credentials must at a minimum allow interaction with
CloudFormation stacks and granting all suitable permissions to stack resources
via IAM roles.

To make credentials available, either create a credentials file in the standard
location, set environment variables to hold the key, secret key and region, or
run on an EC2 instance with an IAM role that has suitable permissions. These
options are [described in the AWS SDK documentation][1].

For example, if using environment variables:

```bash
export AWS_ACCESS_KEY_ID=<key>
export AWS_SECRET_ACCESS_KEY=<secret key>
export AWS_REGION=us-east-1
```

Alternatively, CloudFormation Deploy accepts an optional configuration object
that is passed to the AWS SDK CloudFormation client instance if present.
This is not recommended: it is bad practice to specify access keys in code or
configuration for code. You should always add them to the environment in one of
the ways noted above.

[1]: http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html
