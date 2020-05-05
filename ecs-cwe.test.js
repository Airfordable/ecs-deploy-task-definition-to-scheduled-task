const ecsCwe = require('./ecs-cwe');

const awsId = '00000000001';
const region = 'us-east-1';

function getTaskDefArn(taskName = 'demo', taskVersion = 1) {
    return `arn:aws:ecs:${region}:${awsId}:task-definition/${taskName}:${taskVersion}`;
}

function getTargetObject(clusterName = 'default', taskName, taskVersion) {
    return   {
        Id: 'Demo-Scheduled-Task',
        Arn: `arn:aws:ecs:${region}:${awsId}:cluster/${clusterName}`,
        RoleArn: `arn:aws:iam::${awsId}:role/ecsEventsRole`,
        Input: '{"containerOverrides":[{"name":"Demo","command":["sleep"," 50"]}]}',
        EcsParameters: {
            TaskDefinitionArn: getTaskDefArn(taskName, taskVersion),
            TaskCount: 1,
            LaunchType: 'EC2'
        }
    };
}

describe('filterNonEcsClusterTargets', () => {
    const clusterName = 'foo';

    it('Can handle non-ECS ARNs', async () => {
        const target = getTargetObject('baz');
        target.Arn = `arn:aws:somethingElse:::`;
        const targets = [target];
        const filtered = ecsCwe.filterNonEcsClusterTargets(targets, clusterName);

        expect(Array.isArray(filtered)).toBe(true);
        expect(filtered).toHaveLength(0);
    });

    it('Removes non-cluster targets', async () => {
        const targets = [
            getTargetObject('baz'),
            getTargetObject(clusterName),
            getTargetObject('bar'),
            getTargetObject(clusterName),
        ];
        const filtered = ecsCwe.filterNonEcsClusterTargets(targets, clusterName);

        expect(Array.isArray(filtered)).toBe(true);
        expect(filtered).toHaveLength(2);
        expect(filtered).toContain(targets[1]);
        expect(filtered).toContain(targets[3]);
    });

    it('Handles an empty targets list', async () => {
        const filtered = ecsCwe.filterNonEcsClusterTargets([], clusterName);

        expect(Array.isArray(filtered)).toBe(true);
        expect(filtered).toHaveLength(0);
    });
});

describe('filterUnrelatedTaskDefTargets', () => {
    const newTaskDefArn = getTaskDefArn();

    it('Handles an empty targets list', async () => {
        const filtered = ecsCwe.filterUnrelatedTaskDefTargets([], newTaskDefArn);

        expect(Array.isArray(filtered)).toBe(true);
        expect(filtered).toHaveLength(0);
    });

    it('Filters targets that are not related', async () => {
        const targets = [
            getTargetObject(undefined, 'foo'),
            getTargetObject(), // should keep
            getTargetObject(undefined, undefined, 4), // should keep
        ];
        const filtered = ecsCwe.filterUnrelatedTaskDefTargets(targets, newTaskDefArn);

        expect(Array.isArray(filtered)).toBe(true);
        expect(filtered).toHaveLength(2);
        expect(filtered).toContain(targets[1]);
        expect(filtered).toContain(targets[2]);
    });

    it('Errors on invalid taskDefArn', async () => {
        const notArn = 'foo';
        const invalidTaskArn = `arn:aws:ecs:${region}:${awsId}:something_else:unrelated`;
        expect(() => ecsCwe.filterUnrelatedTaskDefTargets([], notArn)).toThrow(notArn);
        expect(() => ecsCwe.filterUnrelatedTaskDefTargets([], invalidTaskArn)).toThrow(invalidTaskArn);
    });
});
