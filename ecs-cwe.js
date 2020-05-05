/**
 * Contains functions useful for working with CloudWatchEvents + ECS tasks
 */

/*
 * Rule object:
 * {
 *     Name: 'Demo',
 *     Arn: 'arn:aws:events:us-east-1:00000000001:rule/Demo',
 *     State: 'DISABLED',
 *     Description: 'Demo to see how well this works',
 *     ScheduleExpression: 'rate(1 minute)',
 *     EventBusName: 'default'
 * },
 *
 * Target object:
 * {
 *   Id: 'Demo-Scheduled-Task',
 *   Arn: 'arn:aws:ecs:<REGION>:<ACCOUNT ID>:cluster/<CLUSTER NAME>',
 *   RoleArn: 'arn:aws:iam::<ACCOUNT ID>:role/ecsEventsRole',
 *   Input: '{"containerOverrides":[{"name":"Demo","command":["sleep"," 50"]}]}',
 *   EcsParameters: {
 *     TaskDefinitionArn:
 *     'arn:aws:ecs:<REGION>:<ACCOUNT ID>:task-definition/Demo:<VERSION>',
 *     TaskCount: 1,
 *     LaunchType: 'EC2'
 *   }
 * }
 */

/**
 * Strips all information after the task-definition/<name> bits out of
 * the given ARN. Needed so we can find related task ARNs. Designed so
 * that any extention of the Task definition ARN will not break this
 * logic.
 */
function simplifyTaskDefinitionArn(arn) {
    // arn:aws:ecs:<REGION>:<ACCOUNT ID>:task-definition/<task-family-name>:<VERSION>
    const splitArn = arn.split(':');
    if (splitArn.length < 6 || !splitArn[5].startsWith('task-definition/'))
        throw new Error(`Not task-definition ARN: ${arn}`);

    // Cut it down to only the fields we care about; discard the rest.
    splitArn.length = 6;
    return splitArn.join(':');
}

/**
 * Given an array of Cloud Watch Event targets and an ECS cluster name,
 * this function will filter out any targets that are not part of the
 * ECS cluster of the given name.
 * @param {[CloudWatchEventTargets]} targets - The targets from
 * listTargetsByRule
 * @param {string} clusterName - Name of the cluster to filter on.
 * @return {[CloudWatchEventTargets]} All targets associated with the
 * cluster.
 */
function filterNonEcsClusterTargets(targets, clusterName) {
    // arn:aws:ecs:<REGION>:<ACCOUNT ID>:cluster/<CLUSTER NAME>
    const arnClusterName = `cluster/${clusterName}`;
    return targets.filter((target) => {
        const splitArn = target.Arn.split(':');
        return splitArn[2] === 'ecs' && splitArn[5] === arnClusterName;
    });
}

/**
 * Given an array of Cloud Watch Event targets and a new task
 * definition ARN, this function will filter out any targets that have
 * no association with the provided task definition ARN. In effect
 * this keeps all targets with an older version of the given task
 * definition ARN.
 * @param {[CloudWatchEventTargets]} targets - The targets to filter
 * @param {string} newTaskDefArn - The full new task ARN.
 * @return {[CloudWatchEventTargets]} All targets associated with the
 * ARN (all previous versions of this task)
 */
function filterUnrelatedTaskDefTargets(targets, newTaskDefArn) {
    const newTaskDefArnSimple = simplifyTaskDefinitionArn(newTaskDefArn);
    return targets.filter((target) => {
        const arn = target.EcsParameters.TaskDefinitionArn;
        const taskDefArnSimple = simplifyTaskDefinitionArn(arn);
        return taskDefArnSimple === newTaskDefArnSimple;
    });
}

module.exports = {
    filterNonEcsClusterTargets,
    filterUnrelatedTaskDefTargets,
}
