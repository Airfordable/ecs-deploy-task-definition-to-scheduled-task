const aws = require('aws-sdk');
const core = require('@actions/core');
const ecsCwe = require('./ecs-cwe');
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

// Attributes that are returned by DescribeTaskDefinition, but are not valid RegisterTaskDefinition inputs
const IGNORED_TASK_DEFINITION_ATTRIBUTES = [
  'compatibilities',
  'taskDefinitionArn',
  'requiresAttributes',
  'revision',
  'status',
  'registeredAt',
  'deregisteredAt',
  'registeredBy',
];

function isEmptyValue(value) {
  if (value === null || value === undefined || value === '') {
    return true;
  }

  if (Array.isArray(value) && value.length === 0) {
    return true;
  }

  if (typeof value === 'object' && Object.values(value).length === 0) {
    return true;
  }

  return false;
}

function emptyValueReplacer(_, value) {
  if (isEmptyValue(value)) {
    return undefined;
  }

  if (typeof value === 'object') {
    for (const childValue of Object.values(value)) {
      if (!isEmptyValue(childValue)) {
        // the object has at least one non-empty property
        return value;
      }
    }
    // the object has no non-empty property
    return undefined;
  }

  return value;
}

function cleanNullKeys(obj) {
  return JSON.parse(JSON.stringify(obj, emptyValueReplacer));
}

function removeIgnoredAttributes(taskDef) {
  for (const attribute of IGNORED_TASK_DEFINITION_ATTRIBUTES) {
    if (taskDef[attribute]) {
      core.warning(
        `Ignoring property '${attribute}' in the task definition file. ` +
          'This property is returned by the Amazon ECS DescribeTaskDefinition API and may be shown in the ECS console, ' +
          'but it is not a valid field when registering a new task definition. ' +
          'This field can be safely removed from your task definition file.'
      );
      delete taskDef[attribute];
    }
  }

  return taskDef;
}

/*
 * Target object:
 * {
 *   Id: 'Alpine-Cron-Demo-Scheduled-Task',
 *   Arn: 'arn:aws:ecs:<REGION>:<ACCOUNT ID>:cluster/<CLUSTER NAME>',
 *   RoleArn: 'arn:aws:iam::<ACCOUNT ID>:role/ecsEventsRole',
 *   Input: '{"containerOverrides":[{"name":"Alpine-Demo","command":["sleep"," 50"]}]}',
 *   EcsParameters: {
 *     TaskDefinitionArn:
 *     'arn:aws:ecs:<REGION>:<ACCOUNT ID>:task-definition/Alpine-Cron-Demo:<VERSION>',
 *     TaskCount: 1,
 *     LaunchType: 'EC2'
 *   }
 * }
 */

async function processCloudwatchEventRule(
  cwe,
  rule,
  clusterName,
  newTaskDefArn
) {
  const ruleName = rule.Name;
  core.debug(`Looking up Targets for rule ${ruleName}`);

  const data = await cwe
    .listTargetsByRule({
      Rule: ruleName,
    })
    .promise();
  const ruleTargets = data && data.Targets;
  core.debug(`Rule targets for ${ruleName}: ${JSON.stringify(ruleTargets)}`);

  if (!ruleTargets || !ruleTargets.length) return null;

  // Return all targets that are relevant to this cluster.
  const ecsClusterTargets = ecsCwe.filterNonEcsClusterTargets(
    ruleTargets,
    clusterName
  );
  core.debug(
    `ECS ${clusterName} targets for ${ruleName}: ${JSON.stringify(
      ecsClusterTargets
    )}`
  );

  // Of the relevant targets, find the ones whose ARN task matches new ARN (minus version)
  const ecsClusterTaskTargets = ecsCwe.filterUnrelatedTaskDefTargets(
    ecsClusterTargets,
    newTaskDefArn
  );
  core.debug(
    `Task targets for ${ruleName}: ${JSON.stringify(ecsClusterTaskTargets)}`
  );

  // Bail if nothing to update.
  if (!ecsClusterTaskTargets.length) return null;

  // Now we just have to update all the targets that survived.
  const updatedTargets = ecsClusterTaskTargets.map((target) => {
    target.EcsParameters.TaskDefinitionArn = newTaskDefArn;
    return target;
  });
  core.debug(
    `Updated targets for ${ruleName}: ${JSON.stringify(updatedTargets)}`
  );

  return cwe
    .putTargets({
      Rule: ruleName,
      Targets: updatedTargets,
    })
    .promise();
}

async function run() {
  try {
    const awsCommonOptions = {
      customUserAgent: 'amazon-ecs-deploy-task-definition-for-github-actions',
    };

    const ecs = new aws.ECS(awsCommonOptions);
    const cwe = new aws.CloudWatchEvents(awsCommonOptions);

    // Get inputs
    const taskDefinitionFile = core.getInput('task-definition', {
      required: true,
    });
    const cluster = core.getInput('cluster', { required: false }) || 'default';
    const rulePrefix = core.getInput('rule-prefix', { required: false }) || '';

    // Register the task definition
    core.debug('Registering the task definition');
    const taskDefPath = path.isAbsolute(taskDefinitionFile)
      ? taskDefinitionFile
      : path.join(process.env.GITHUB_WORKSPACE, taskDefinitionFile);
    const fileContents = fs.readFileSync(taskDefPath, 'utf8');
    const taskDefContents = removeIgnoredAttributes(
      cleanNullKeys(yaml.parse(fileContents))
    );
    let registerResponse;
    try {
      registerResponse = await ecs
        .registerTaskDefinition(taskDefContents)
        .promise();
      core.debug(`Register response: ${JSON.stringify(registerResponse)}`);
    } catch (error) {
      core.setFailed(
        'Failed to register task definition in ECS: ' + error.message
      );
      core.debug('Task definition contents:');
      core.debug(JSON.stringify(taskDefContents, undefined, 4));
      throw error;
    }
    const taskDefArn = registerResponse.taskDefinition.taskDefinitionArn;
    core.setOutput('task-definition-arn', taskDefArn);

    // TODO: Batch this?
    const data = await cwe.listRules().promise();
    const rules = (data && data.Rules) || [];
    await Promise.all(
      rules
        .filter((rule) => {
          return rule.Name.startsWith(rulePrefix);
        })
        .map((rule) => {
          return processCloudwatchEventRule(cwe, rule, cluster, taskDefArn);
        })
    );
  } catch (error) {
    core.setFailed(error.message);
    core.debug(error.stack);
  }
}

module.exports = run;

/* istanbul ignore next */
if (require.main === module) {
  run();
}
