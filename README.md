## ECS "Deploy Task Definition to Scheduled Tasks" Action for GitHub Actions

Registers an Amazon ECS task definition and deploys it to scheduled tasks in a given ECS cluster

**Table of Contents**

<!-- toc -->

- [Acknowledgements](#acknowledgements)
- [Usage](#usage)
- [Credentials and Region](#credentials-and-region)
- [Permissions](#permissions)
- [Troubleshooting](#troubleshooting)
- [License Summary](#license-summary)

<!-- tocstop -->

## Acknowledgements

This project is a fork of the [amazon-ecs-deploy-task-definition](https://github.com/aws-actions/amazon-ecs-deploy-task-definition) that has been modified and re-tooled to work with ECS scheduled tasks. As such its initial release version starts at 2.0.0. Be sure to use the correct tag.

## Usage

The action assumes you have already setup 1 or more tasks to run as a scheduled task in the ECS environment. This action will update _all_ of the tasks who cluster, task ARN (without version), and rule-prefix match existing scheduled actions or cloudwatch events. To use this action simply add the following step to your deploy process:

```yaml
- name: Deploy to Amazon ECS Scheduled Tasks
  uses: airfordable/ecs-deploy-task-definition-to-scheduled-task@v2.0.0
  with:
    cluster: my-cluster (optional, defaults to 'default')
    rule-prefix: my-rule-prefix (optional, defaults to '')
    task-definition: task-definition.json
```

The action requires a `task-definition`. Your `task-definition` will likely be dynamically generated via [the `aws-actions/amazon-ecs-render-task-definition` action](https://github.com/aws-actions/amazon-ecs-render-task-definition) or equivalent action.

See [action.yml](action.yml) for the full documentation for this action's inputs and outputs.

## Credentials and Region

This action relies on the [default behavior of the AWS SDK for Javascript](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html) to determine AWS credentials and region.
Use [the `aws-actions/configure-aws-credentials` action](https://github.com/aws-actions/configure-aws-credentials) to configure the GitHub Actions environment with environment variables containing AWS credentials and your desired region.

Amazon recommends following [Amazon IAM best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html) for the AWS credentials used in GitHub Actions workflows, including:

- Do not store credentials in your repository's code. You may use [GitHub Actions secrets](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/creating-and-using-encrypted-secrets) to store credentials and redact credentials from GitHub Actions workflow logs.
- [Create an individual IAM user](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#create-iam-users) with an access key for use in GitHub Actions workflows, preferably one per repository. Do not use the AWS account root user access key.
- [Grant least privilege](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#grant-least-privilege) to the credentials used in GitHub Actions workflows. Grant only the permissions required to perform the actions in your GitHub Actions workflows. See the Permissions section below for the permissions required by this action.
- [Rotate the credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#rotate-credentials) used in GitHub Actions workflows regularly.
- [Monitor the activity](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#keep-a-log) of the credentials used in GitHub Actions workflows.

## Permissions

This action requires the following minimum set of permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": ["ecs:RegisterTaskDefinition"],
      "Effect": "Allow",
      "Resource": "*",
      "Sid": "RegisterTaskDefinition"
    },
    {
      "Action": ["events:ListRules", "events:ListTargetsByRule"],
      "Effect": "Allow",
      "Resource": "*",
      "Sid": "ListRulesAndTargets"
    },
    {
      "Action": ["events:PutTargets"],
      "Effect": "Allow",
      "Resource": "arn:aws:events::<aws_account_id>:rule/<cloudwatch_event_rule_name>",
      "Sid": "PutTargets"
    },
    {
      "Action": ["iam:PassRole"],
      "Effect": "Allow",
      "Resource": [
        "arn:aws:iam::<aws_account_id>:role/<task_definition_task_role_name>",
        "arn:aws:iam::<aws_account_id>:role/<task_definition_task_execution_role_name>"
      ],
      "Sid": "PassRolesInTaskDefinition"
    }
  ]
}
```

Note: the policy above assumes the account has opted in to the ECS long ARN format.

## Troubleshooting

This action emits debug logs to help troubleshoot deployment failures. To see the debug logs, create a secret named `ACTIONS_STEP_DEBUG` with value `true` in your repository.

## License Summary

This code is made available under the MIT license.
