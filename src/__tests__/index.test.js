const run = require('../index.js');
const core = require('@actions/core');
const fs = require('fs');
const path = require('path');

jest.mock('@actions/core');
jest.mock('fs');

const taskDefinitionArn = 'arn:aws:ecs:::task-definition/demo-task:42';

const mockEcsRegisterTaskDef = jest.fn();
const mockCweListRules = jest.fn();
const mockCweListTargetsByRule = jest.fn();
const mockCwePutTargets = jest.fn();
jest.mock('aws-sdk', () => {
  return {
    config: {
      region: 'fake-region',
    },
    CloudWatchEvents: jest.fn(() => ({
      listRules: mockCweListRules,
      listTargetsByRule: mockCweListTargetsByRule,
      putTargets: mockCwePutTargets,
    })),
    ECS: jest.fn(() => ({
      registerTaskDefinition: mockEcsRegisterTaskDef,
    })),
  };
});

function awsResponsePromise(val) {
  return () => ({
    promise: async () => (typeof val === 'function' ? val() : val),
  });
}

describe('Deploy to ECS', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    core.getInput = jest
      .fn()
      .mockReturnValueOnce('task-definition.json') // task-definition
      .mockReturnValueOnce('service-456') // service
      .mockReturnValueOnce('cluster-789'); // cluster

    process.env = Object.assign(process.env, { GITHUB_WORKSPACE: __dirname });

    fs.readFileSync.mockImplementation((pathInput, encoding) => {
      if (encoding != 'utf8') {
        throw new Error(`Wrong encoding ${encoding}`);
      }

      if (
        pathInput == path.join(process.env.GITHUB_WORKSPACE, 'appspec.yaml')
      ) {
        return `
                Resources:
                - TargetService:
                    Type: AWS::ECS::Service
                    Properties:
                      TaskDefinition: helloworld
                      LoadBalancerInfo:
                        ContainerName: web
                        ContainerPort: 80`;
      }

      if (
        pathInput ==
        path.join(process.env.GITHUB_WORKSPACE, 'task-definition.json')
      ) {
        return JSON.stringify({ family: 'task-def-family' });
      }

      throw new Error(`Unknown path ${pathInput}`);
    });

    mockEcsRegisterTaskDef.mockImplementation(() => {
      return {
        promise() {
          return Promise.resolve({ taskDefinition: { taskDefinitionArn } });
        },
      };
    });

    mockCweListRules.mockImplementation(() => {
      return {
        promise() {
          return Promise.resolve({
            Rules: [
              {
                Name: 'Sync-Task',
                Arn: 'arn:aws:events:us-east-1:00000000001:rule/Sync-Task',
                State: 'ENABLED',
                Description: 'Foooo.',
                ScheduleExpression: 'rate(15 minutes)',
                EventBusName: 'default',
              },
              {
                Name: 'Prefixed-Task',
                Arn: 'arn:aws:events:us-east-1:00000000001:rule/Prefixed-Task',
                State: 'ENABLED',
                Description: 'Barrr.',
                ScheduleExpression: 'rate(20 minutes)',
                EventBusName: 'default',
              },
            ],
          });
        },
      };
    });

    mockCweListTargetsByRule.mockImplementation(() => {
      return {
        promise() {
          return Promise.resolve({
            Targets: [
              {
                Id: 'Baz',
                Arn:
                  'arn:aws:ecs:<REGION>:<ACCOUNT ID>:cluster/another-cluster',
                RoleArn: 'arn:aws:iam::<ACCOUNT ID>:role/ecsEventsRole',
                Input:
                  '{"containerOverrides":[{"name":"Demo","command":["sleep"," 50"]}]}',
                EcsParameters: {
                  TaskDefinitionArn:
                    'arn:aws:ecs:<REGION>:<ACCOUNT ID>:task-definition/task-def-family:1',
                  TaskCount: 1,
                  LaunchType: 'EC2',
                },
              },
              {
                Id: 'Foo',
                Arn: 'arn:aws:ecs:<REGION>:<ACCOUNT ID>:cluster/fake-cluster',
                RoleArn: 'arn:aws:iam::<ACCOUNT ID>:role/ecsEventsRole',
                Input:
                  '{"containerOverrides":[{"name":"Demo","command":["sleep"," 50"]}]}',
                EcsParameters: {
                  TaskDefinitionArn: taskDefinitionArn,
                  TaskCount: 1,
                  LaunchType: 'EC2',
                },
              },
              {
                Id: 'Bar',
                Arn: 'arn:aws:ecs:<REGION>:<ACCOUNT ID>:cluster/fake-cluster',
                RoleArn: 'arn:aws:iam::<ACCOUNT ID>:role/ecsEventsRole',
                Input:
                  '{"containerOverrides":[{"name":"Demo","command":["sleep"," 50"]}]}',
                EcsParameters: {
                  TaskDefinitionArn:
                    'arn:aws:ecs:<REGION>:<ACCOUNT ID>:task-definition/another-task-family:1',
                  TaskCount: 1,
                  LaunchType: 'EC2',
                },
              },
            ],
          });
        },
      };
    });

    mockCwePutTargets.mockImplementation(() => {
      return {
        promise() {
          return Promise.resolve();
        },
      };
    });
  });

  test('registers the task definition contents', async () => {
    await run();
    expect(core.setFailed).toHaveBeenCalledTimes(0);
    expect(mockEcsRegisterTaskDef).toHaveBeenNthCalledWith(1, {
      family: 'task-def-family',
    });
    expect(core.setOutput).toHaveBeenNthCalledWith(
      1,
      'task-definition-arn',
      taskDefinitionArn
    );
  });

  test('updates the appropriate targets', async () => {});

  test('cleans null keys out of the task definition contents', async () => {
    fs.readFileSync.mockImplementation((pathInput, encoding) => {
      if (encoding != 'utf8') {
        throw new Error(`Wrong encoding ${encoding}`);
      }

      return '{ "ipcMode": null, "family": "task-def-family" }';
    });

    await run();
    expect(core.setFailed).toHaveBeenCalledTimes(0);
    expect(mockEcsRegisterTaskDef).toHaveBeenNthCalledWith(1, {
      family: 'task-def-family',
    });
  });

  test('cleans empty arrays out of the task definition contents', async () => {
    fs.readFileSync.mockImplementation((pathInput, encoding) => {
      if (encoding != 'utf8') {
        throw new Error(`Wrong encoding ${encoding}`);
      }

      return '{ "tags": [], "family": "task-def-family" }';
    });

    await run();
    expect(core.setFailed).toHaveBeenCalledTimes(0);
    expect(mockEcsRegisterTaskDef).toHaveBeenNthCalledWith(1, {
      family: 'task-def-family',
    });
  });

  test('cleans empty strings and objects out of the task definition contents', async () => {
    fs.readFileSync.mockImplementation((pathInput, encoding) => {
      if (encoding != 'utf8') {
        throw new Error(`Wrong encoding ${encoding}`);
      }

      return '{ "memory": "", "containerDefinitions": [ { "name": "sample-container", "logConfiguration": {}, "repositoryCredentials": { "credentialsParameter": "" }, "cpu": 0, "essential": false } ], "requiresCompatibilities": [ "EC2" ], "family": "task-def-family" }';
    });

    await run();
    expect(core.setFailed).toHaveBeenCalledTimes(0);
    expect(mockEcsRegisterTaskDef).toHaveBeenNthCalledWith(1, {
      family: 'task-def-family',
      containerDefinitions: [
        {
          name: 'sample-container',
          cpu: 0,
          essential: false,
        },
      ],
      requiresCompatibilities: ['EC2'],
    });
  });

  test('cleans invalid keys out of the task definition contents', async () => {
    fs.readFileSync.mockImplementation((pathInput, encoding) => {
      if (encoding != 'utf8') {
        throw new Error(`Wrong encoding ${encoding}`);
      }

      return '{ "compatibilities": ["EC2"], "taskDefinitionArn": "arn:aws...:task-def-family:1", "family": "task-def-family", "revision": 1, "status": "ACTIVE" }';
    });

    await run();
    expect(core.setFailed).toHaveBeenCalledTimes(0);
    expect(mockEcsRegisterTaskDef).toHaveBeenNthCalledWith(1, {
      family: 'task-def-family',
    });
  });

  test('registers the task definition contents at an absolute path', async () => {
    core.getInput = jest
      .fn()
      .mockReturnValueOnce('/hello/task-definition.json');
    fs.readFileSync.mockImplementation((pathInput, encoding) => {
      if (encoding != 'utf8') {
        throw new Error(`Wrong encoding ${encoding}`);
      }

      if (pathInput == '/hello/task-definition.json') {
        return JSON.stringify({ family: 'task-def-family-absolute-path' });
      }

      throw new Error(`Unknown path ${pathInput}`);
    });

    await run();
    expect(core.setFailed).toHaveBeenCalledTimes(0);

    expect(mockEcsRegisterTaskDef).toHaveBeenNthCalledWith(1, {
      family: 'task-def-family-absolute-path',
    });
    expect(core.setOutput).toHaveBeenNthCalledWith(
      1,
      'task-definition-arn',
      taskDefinitionArn
    );
  });

  test('updates related task def rules', async () => {
    core.getInput = jest
      .fn()
      .mockReturnValueOnce('task-definition.json') // task-definition
      .mockReturnValueOnce('fake-cluster'); // cluster - matches above ARN

    await run();
    expect(core.setFailed).toHaveBeenCalledTimes(0);

    expect(mockCweListRules).toHaveBeenCalledTimes(1);
    // Only two list rules, so will only get called twice.
    expect(mockCweListTargetsByRule).toHaveBeenCalledTimes(2);
    expect(mockCwePutTargets).toHaveBeenCalledTimes(2);

    const callValue1 = mockCwePutTargets.mock.calls[0][0];
    expect(callValue1.Rule).toEqual('Sync-Task');
    expect(Array.isArray(callValue1.Targets)).toBe(true);
    expect(callValue1.Targets).toHaveLength(1);
    expect(callValue1.Targets[0].Id).toEqual('Foo');

    const callValue2 = mockCwePutTargets.mock.calls[1][0];
    expect(callValue2.Rule).toEqual('Prefixed-Task');
    expect(Array.isArray(callValue2.Targets)).toBe(true);
    expect(callValue2.Targets).toHaveLength(1);
    expect(callValue2.Targets[0].Id).toEqual('Foo');
  });

  test('No updates if no related task def rules', async () => {
    core.getInput = jest
      .fn()
      .mockReturnValueOnce('task-definition.json') // task-definition
      .mockReturnValueOnce('non-existant-cluster'); // cluster - matches above ARN

    await run();
    expect(core.setFailed).toHaveBeenCalledTimes(0);

    expect(mockCweListRules).toHaveBeenCalledTimes(1);
    // Only two list rules, so will only get called twice.
    expect(mockCweListTargetsByRule).toHaveBeenCalledTimes(2);
    expect(mockCwePutTargets).toHaveBeenCalledTimes(0);
  });

  test('updates prefixed task def rules', async () => {
    core.getInput = jest
      .fn()
      .mockReturnValueOnce('task-definition.json') // task-definition
      .mockReturnValueOnce('fake-cluster') // cluster - matches above ARN
      .mockReturnValueOnce('Prefixed-');

    await run();
    expect(core.setFailed).toHaveBeenCalledTimes(0);

    expect(mockCweListRules).toHaveBeenCalledTimes(1);
    // Only one prefixed list rule, so will only get called once.
    expect(mockCweListTargetsByRule).toHaveBeenCalledTimes(1);
    expect(mockCwePutTargets).toHaveBeenCalledTimes(1);

    const callValue = mockCwePutTargets.mock.calls[0][0];
    expect(callValue.Rule).toEqual('Prefixed-Task');
    expect(Array.isArray(callValue.Targets)).toBe(true);
    expect(callValue.Targets).toHaveLength(1);
    expect(callValue.Targets[0].Id).toEqual('Foo');
  });

  test('error is caught if task def registration fails', async () => {
    mockEcsRegisterTaskDef.mockImplementation(() => {
      throw new Error('Could not parse');
    });

    await run();

    expect(core.setFailed).toHaveBeenCalledTimes(2);
    expect(core.setFailed).toHaveBeenNthCalledWith(
      1,
      'Failed to register task definition in ECS: Could not parse'
    );
    expect(core.setFailed).toHaveBeenNthCalledWith(2, 'Could not parse');
  });

  test('error is caught if listRules fails', async () => {
    const msg = 'Foo bar';
    mockCweListRules.mockImplementation(
      awsResponsePromise(() => {
        throw new Error(msg);
      })
    );

    await run();

    expect(core.setFailed).toHaveBeenCalledTimes(1);
    expect(core.setFailed).toHaveBeenNthCalledWith(1, msg);
  });
});
