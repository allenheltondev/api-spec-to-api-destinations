const fs = require('fs');
const core = require('@actions/core');
const yaml = require('js-yaml');
const { replaceBracketsWithAsterisk, getResourceName } = require('./formatters');
const {loadQueryParams, getDefinedQueryParams} = require('./parameters');

function buildTemplateFromSpec(apiSpec, supportedMethods, resourcePrefix, blueprint, environment) {
  const queryParams = loadQueryParams(apiSpec);
  const baseUrl = getBaseUrl(apiSpec, environment);
  if(!baseUrl){
    return;
  }

  const apiDestinations = [];
  let resources = getStaticResources();
  for (const [key, value] of Object.entries(apiSpec.paths)) {
    const path = replaceBracketsWithAsterisk(key);
    const pathQueryParams = getDefinedQueryParams(value, queryParams);

    for (const [httpMethod, endpointDefinition] of Object.entries(value)) {
      if (supportedMethods.has(httpMethod.toUpperCase())) {
        const resourceName = getResourceName(resourcePrefix, path, httpMethod);
        if(!endpointDefinition.operationId){
          core.warning(`Resource ${resourceName} does not have an 'operationId' defined. Skipping creation.`);
          continue;
        }

        core.info(`Creating API destination ${resourceName} with trigger '${endpointDefinition.operationId}'`);
        apiDestinations.push(resourceName);

        const allQueryParams = {
          ...pathQueryParams,
          ...getDefinedQueryParams(endpointDefinition, queryParams)
        };
        const endpointResources = buildResources(resourceName, key, path, httpMethod, endpointDefinition, allQueryParams, baseUrl);

        resources = { ...resources, ...endpointResources };
      }
    }
  }

  addApiDestinationsToRole(resources, apiDestinations);
  let template;
  if (blueprint) {
    template = yaml.load(fs.readFileSync(blueprint, 'utf8'));
  } else {
    template = getDefaultTemplate();
  }

  template.Resources = { ...template.Resources, ...resources };

  return template;
}

function getStaticResources() {
  return {
    ApiDestinationsTargetRole: {
      Type: "AWS::IAM::Role",
      Properties: {
        AssumeRolePolicyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: {
                Service: "events.amazonaws.com"
              },
              Action: "sts:AssumeRole"
            }
          ]
        },
        Path: "/service-role/",
        Policies: [
          {
            PolicyName: "destinationinvoke",
            PolicyDocument: {
              Version: "2012-10-17",
              Statement: [
                {
                  Effect: "Allow",
                  Action: [
                    "events:InvokeApiDestination"
                  ],
                  Resource: []
                }
              ]
            }
          }
        ]
      }
    },
    FailedDeliveryDLQ: {
      "Type": "AWS::SQS::Queue"
    },
    ApiConnection: {
      Type: "AWS::Events::Connection",
      Properties: {
        AuthorizationType: "API_KEY",
        AuthParameters: {
          ApiKeyAuthParameters: {
            ApiKeyName: "Authorization",
            ApiKeyValue: {
              "Fn::Sub": "${MomentoAuthToken}"
            }
          }
        }
      }
    }
  };
}

function addApiDestinationsToRole(resources, destinations) {
  resources.ApiDestinationsTargetRole.Properties.Policies[0].PolicyDocument.Statement[0].Resource = destinations.map(d => {
    return {
      "Fn::GetAtt": [d, "Arn"]
    };
  })
}

function buildInputTransformer(definition) {
  if (definition.requestBody?.content) {
    return {
      InputTransformer: {
        InputPathsMap: {
          message: "$.detail.message"
        },
        InputTemplate: "\"<message>\""
      }
    };
  }
}

function getDefaultTemplate() {
  return {
    AWSTemplateFormatVersion: '2010-09-09',
    Description: 'CloudFormation template that deploys EventBridge rules and API destinations for my API',
    Resources: {}
  };
}

function extractParams(path) {
  const regex = /{([^}]+)}/g;
  const params = [];
  let match;

  while ((match = regex.exec(path)) !== null) {
    params.push(match[1]);
  }

  return params;
}

function buildResources(resourceName, path, friendlyPath, httpMethod, definition, queryParams, baseUrl) {
  const params = extractParams(path);
  const inputTransformer = buildInputTransformer(definition);
  const resources = {
    [resourceName]: {
      Type: "AWS::Events::ApiDestination",
      Properties: {
        ConnectionArn: {
          "Fn::GetAtt": ["ApiConnection", "Arn"]
        },
        HttpMethod: httpMethod.toUpperCase(),
        InvocationEndpoint: `${baseUrl}${friendlyPath}`,
        InvocationRateLimitPerSecond: 300
      }
    },
    [`${resourceName}Rule`]: {
      Type: "AWS::Events::Rule",
      Properties: {
        EventBusName: { Ref: 'EventBusName' },
        EventPattern: {
          "detail-type": [definition.operationId]
        },
        State: "ENABLED",
        Targets: [
          {
            Id: `${definition.operationId}-rule`,
            Arn: {
              "Fn::GetAtt": [resourceName, "Arn"]
            },
            RoleArn: {
              "Fn::GetAtt": ["ApiDestinationsTargetRole", "Arn"]
            },
            ...inputTransformer && inputTransformer,
            ...params.length && {
              HttpParameters: {
                PathParameterValues: params.map(p => `$.detail.${p}`)

              }
            },
            DeadLetterConfig: {
              Arn: {
                'Fn::GetAtt': ["FailedDeliveryDLQ", "Arn"]
              }
            }
          }
        ],
      }
    }
  };

  if (Object.keys(queryParams).length) {
    if (!resources[`${resourceName}Rule`].Properties.Targets[0].HttpParameters) {
      resources[`${resourceName}Rule`].Properties.Targets[0].HttpParameters = {};
    }

    resources[`${resourceName}Rule`].Properties.Targets[0].HttpParameters.QueryStringParameters = queryParams;
  }

  return resources;
}

function getBaseUrl (spec, environment) {
  let server;
  if(environment){
    server = spec.servers?.find(s => s.description?.toLowerCase() == environment?.toLowerCase());
    if(!server?.url){
      core.error(`An environment with the name '${environment}' does not exist in the servers object of your API spec`);
      core.setFailed('Could not find environment');
      return;
    } else {
      return server.url.endsWith('/') ? server.url.slice(0, -1) : server.url;
    }
  }

  server = spec.servers?.find(s => s.url);
  if(!server?.url){
    core.error(`Your API spec does not contain any valid servers. Please add one or more or provide the environment name`);
    core.setFailed('Could not find environment');
    return;
  } else {
    return server.url.endsWith('/') ? server.url.slice(0, -1) : server.url;
  }
}

module.exports = {
  buildTemplateFromSpec
}
