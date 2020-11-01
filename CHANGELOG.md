# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.0.0]

Initial release of the action. Branched from https://github.com/aws-actions/amazon-ecs-deploy-task-definition.git and modified to support pushing to ecs scheduled tasks instead of ECS services. Starting at 2.0.0 due to project being a fork and thus not being backwards compatible with old code.

### Features

- Adds in support for ECS scheduled tasks.
- Adds in tests to validate logic.
- Removes service deployment code.
