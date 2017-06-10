/**
 * @fileOverview Various useful constants.
 */

// The available AWS stack capabilities values.
exports.capabilities = {
  CAPABILITY_IAM: 'CAPABILITY_IAM',
  CAPABILITY_NAMED_IAM: 'CAPABILITY_NAMED_IAM'
};

// Describing what to do with the current stack on failure to deploy.
exports.onDeployFailure = {
  // Delete the stack.
  DELETE: 'DELETE',
  // Do nothing, leave the failed partial stack for diagnosis. Useful when
  // developing.
  DO_NOTHING: 'DO_NOTHING'
};

// Describing what to do with prior instances of the stack being deployed,
// following a successful deployment.
exports.priorInstance = {
  // Delete the prior instances.
  DELETE: 'DELETE',
  // Do nothing, leave prior instances running.
  DO_NOTHING: 'DO_NOTHING'
};

// By no means a full list, just the ones we care about.
exports.resourceStatus = {
  CREATE_COMPLETE: 'CREATE_COMPLETE',
  CREATE_FAILED: 'CREATE_FAILED',
  DELETE_COMPLETE: 'DELETE_COMPLETE',
  DELETE_FAILED: 'DELETE_FAILED',
  UPDATE_COMPLETE: 'UPDATE_COMPLETE',
  UPDATE_ROLLBACK_COMPLETE: 'UPDATE_ROLLBACK_COMPLETE',
  UPDATE_ROLLBACK_FAILED: 'UPDATE_ROLLBACK_FAILED'
};

exports.resourceType = {
  STACK: 'AWS::CloudFormation::Stack'
};

// Tag names used internally.
exports.tag = {
  STACK_BASE_NAME: 'cloudformation-deploy:stackBaseName',
  STACK_NAME: 'cloudformation-deploy:stackName',
  VERSION: 'cloudformation-deploy:version'
};

// Type of stack operation.
exports.type = {
  CREATE_STACK: 'create',
  DELETE_STACK: 'delete',
  UPDATE_STACK: 'update'
};
