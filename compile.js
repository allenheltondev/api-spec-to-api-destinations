const yaml = require('js-yaml');
const fs   = require('fs');

const specPath = './lib/openapi.yaml';
const blueprint = './lib/blueprint.yaml';
const supportedMethods = ['put', 'post', 'delete'];
const destinationPrefix = 'MomentoApi';
const outputFilename = 'generated.yaml';

let resources= getStaticResources();
const apiDestinations = [];
try {
  const doc = yaml.load(fs.readFileSync(specPath, 'utf8'));
  for(const [key, value] of Object.entries(doc.paths)){    
    const path = replaceBracketsWithAsterisk(key);
    const friendlyPath = getFriendlyPathName(path);
    
    for(const [pathKey, endpointDefinition] of Object.entries(value)){
      if(supportedMethods.includes(pathKey)){
        const resourceName = `${destinationPrefix}${friendlyPath}${pathKey.charAt(0).toUpperCase() + pathKey.slice(1)}`;
        apiDestinations.push(resourceName);
        const endpointResources = buildResources(resourceName, key, path, pathKey, endpointDefinition);
        resources = {...resources, ...endpointResources};
      }
    }
  }
  addApiDestinationsToRole(resources, apiDestinations);
  const template = yaml.load(fs.readFileSync(blueprint, 'utf8'));
  template.Resources = {...template.Resources, ...resources};
  fs.writeFileSync(outputFilename, yaml.dump(template))
  
} catch (e) {
  console.log(e);
}

function replaceBracketsWithAsterisk(path) {
    return path.replace(/\{[^}]+\}/g, '*');
}
function getFriendlyPathName(inputString) {
  const noWildcards = inputString.replace(/[*]/g, '');
  const pieces = noWildcards.split('/').filter(p => p);
  return pieces.map(p => {return p.charAt(0).toUpperCase() + p.slice(1)}).join('');
}

function buildResources (resourceName, path, friendlyPath, httpMethod, definition) {
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
        InvocationEndpoint: {
          "Fn::Sub": [
            `\${RegionEndpoint}${friendlyPath}`,
            {
              "RegionEndpoint": {
                "Fn::FindInMap": [
                  "RegionToEndPoint",
                  {"Ref": "AWS::Region"},
                  "URL"
                ]
              }
            }
          ]
        },
        InvocationRateLimitPerSecond: 300
      }
    },
    [`${resourceName}Rule`]: {
      Type: "AWS::Events::Rule",
      Properties: {
        EventBusName: "default",
        EventPattern: {
          "detail-type": [definition.operationId]
        },
        "State": "ENABLED",
        "Targets": [
          {
            Id: `${definition.operationId}-rule`,
            Arn: {
              "Fn::GetAtt": [resourceName, "Arn"]
            },
            RoleArn: {
              "Fn::GetAtt": ["ApiDestinationsTargetRole", "Arn"]
            },
            ...inputTransformer && inputTransformer,
            ...params.length && {HttpParameters: {
              PathParameterValues:  params.map(p => `$.detail.${p}`)
              
            }}
          }
        ]
      }
    }
  } 
  
  return resources;
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

function getStaticResources () {
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
                Resource: [
                  {
                    "Fn::GetAtt": ["MomentoApiTopicPublish", "Arn"]
                  }
                ]
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
}

}

function addApiDestinationsToRole(resources, destinations) {    resources.ApiDestinationsTargetRole.Properties.Policies[0].PolicyDocument.Statement[0].Resource = destinations.map(d => {
    return {
      "Fn::GetAtt": [d, "Arn"]
    };
  })
}

function buildInputTransformer (definition) {
  if(definition.requestBody?.content){ 
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