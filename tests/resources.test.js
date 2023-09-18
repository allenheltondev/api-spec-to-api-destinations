const { buildTemplateFromSpec } = require('../src/resources');
var spec;

describe('buildTemplateFromSpec', () => {
  beforeEach(() => {
    spec = getExampleSpec();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Only create delete destinations', () => {
    const supportedMethods = new Set(['DELETE']);
    const result = buildTemplateFromSpec(spec, supportedMethods, 'TEST');
    expect(result.Resources).toHaveProperty('TESTCacheDelete');
    expect(result.Resources).toHaveProperty('TESTCacheDeleteRule');
    expect(result.Resources).not.toHaveProperty('TESTCachePut');
    expect(result.Resources).not.toHaveProperty('TESTCachePutRule');
    expect(result.Resources).not.toHaveProperty('TESTCacheGet');
    expect(result.Resources).not.toHaveProperty('TESTCacheGetRule');
    expect(result.Resources).not.toHaveProperty('TESTTopicsPost');
    expect(result.Resources).not.toHaveProperty('TESTTopicsPostRule');
    
    const role = result.Resources.ApiDestinationsTargetRole;
    expect(role.Properties.Policies[0].PolicyDocument.Statement[0].Resource.length).toEqual(1);
    expect(role.Properties.Policies[0].PolicyDocument.Statement[0].Resource[0]['Fn::GetAtt'][0]).toEqual('TESTCacheDelete');
  });

  it('Create Get and Post destinations', () => {
    const supportedMethods = new Set(['GET','POST']);
    const result = buildTemplateFromSpec(spec, supportedMethods, 'TEST2');
    expect(result.Resources).not.toHaveProperty('TEST2CacheDelete');
    expect(result.Resources).not.toHaveProperty('TEST2CacheDeleteRule');
    expect(result.Resources).not.toHaveProperty('TEST2CachePut');
    expect(result.Resources).not.toHaveProperty('TEST2CachePutRule');
    expect(result.Resources).toHaveProperty('TEST2CacheGet');
    expect(result.Resources).toHaveProperty('TEST2CacheGetRule');
    expect(result.Resources).toHaveProperty('TEST2TopicsPost');
    expect(result.Resources).toHaveProperty('TEST2TopicsPostRule');

    const role = result.Resources.ApiDestinationsTargetRole;
    expect(role.Properties.Policies[0].PolicyDocument.Statement[0].Resource.length).toEqual(2);
    expect(role.Properties.Policies[0].PolicyDocument.Statement[0].Resource[0]['Fn::GetAtt'][0]).toEqual('TEST2CacheGet');
    expect(role.Properties.Policies[0].PolicyDocument.Statement[0].Resource[1]['Fn::GetAtt'][0]).toEqual('TEST2TopicsPost');
  });

  it('should not create resources if operationId is missing', () => {   

    const supportedMethods = new Set(['POST', 'PUT']);
    delete spec.paths['/topics/{cacheName}/{topicName}'].post.operationId;

    const result = buildTemplateFromSpec(spec, supportedMethods, 'UNIT');

    expect(result.Resources).not.toHaveProperty('UNITCacheDelete');
    expect(result.Resources).not.toHaveProperty('UNITCacheDeleteRule');
    expect(result.Resources).toHaveProperty('UNITCachePut');
    expect(result.Resources).toHaveProperty('UNITCachePutRule');
    expect(result.Resources).not.toHaveProperty('UNITCacheGet');
    expect(result.Resources).not.toHaveProperty('UNITCacheGetRule');
    expect(result.Resources).not.toHaveProperty('UNITTopicsPost');
    expect(result.Resources).not.toHaveProperty('UNITTopicsPostRule');

    const role = result.Resources.ApiDestinationsTargetRole;
    expect(role.Properties.Policies[0].PolicyDocument.Statement[0].Resource.length).toEqual(1);
    expect(role.Properties.Policies[0].PolicyDocument.Statement[0].Resource[0]['Fn::GetAtt'][0]).toEqual('UNITCachePut');
  });

  it('creates all query parameters in rule', () => {
    const supportedMethods = new Set(['PUT']);

    const result = buildTemplateFromSpec(spec, supportedMethods, 'QUERY');

    expect(result.Resources).toHaveProperty('QUERYCachePut');
    expect(result.Resources).toHaveProperty('QUERYCachePutRule');
    expect(result.Resources.QUERYCachePutRule.Properties).toHaveProperty('Targets');
    expect(result.Resources.QUERYCachePutRule.Properties.Targets).toHaveLength(1);
    const target = result.Resources.QUERYCachePutRule.Properties.Targets[0];
    expect(target).toHaveProperty('HttpParameters');
    expect(target.HttpParameters).toHaveProperty('QueryStringParameters');
    expect(target.HttpParameters.QueryStringParameters).toHaveProperty('ttl_seconds', '$.detail.ttl_seconds');
    expect(target.HttpParameters.QueryStringParameters).toHaveProperty('key', '$.detail.key');
    expect(target.HttpParameters.QueryStringParameters).toHaveProperty('key_base64', '$.detail.key_base64');
    expect(target.HttpParameters).toHaveProperty('PathParameterValues');
    expect(target.HttpParameters.PathParameterValues).toHaveLength(1);
    expect(target.HttpParameters.PathParameterValues[0]).toEqual('$.detail.cacheName');
    
  });
});

const getExampleSpec = () => {
  return {
    "openapi": "3.0.0",
    "info": {
      "title": "Test API"
    },
    "security": [
      {
        "apiTokenQuery": []
      },
      {
        "apiTokenHeader": []
      }
    ],
    "paths": {
      "/cache/{cacheName}": {
        "parameters": [
          {
            "$ref": "#/components/parameters/cacheName"
          },
          {
            "$ref": "#/components/parameters/key"
          },
          {
            "$ref": "#/components/parameters/key_base64"
          }
        ],
        "get": {
          "operationId": "cacheGet",
          "summary": "Get cache item value",
          "responses": {
            "200": {
              "description": "The value of the cache item in raw format",
              "content": {
                "application/octet-stream": {
                  "schema": {
                    "type": "string",
                    "example": "Hello World!"
                  }
                }
              }
            },
            "400": {
              "$ref": "#/components/responses/BadRequest"
            }
          }
        },
        "put": {
          "parameters": [
            {
              "name": "ttl_seconds",
              "in": "query",
              "required": true,
              "schema": {
                "type": "integer",
                "minimum": 0,
                "maximum": 86400
              }
            }
          ],
          "operationId": "cacheSet",
          "summary": "Set cache item value",
          "tags": [
            "Cache"
          ],
          "requestBody": {
            "required": true,
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string"
                }
              }
            }
          },
          "responses": {
            "204": {
              "$ref": "#/components/responses/NoContent"
            },
            "400": {
              "$ref": "#/components/responses/BadRequest"
            }
          }
        },
        "delete": {
          "operationId": "cacheDelete",
          "summary": "Delete cache item",
          "responses": {
            "204": {
              "$ref": "#/components/responses/NoContent"
            },
            "400": {
              "$ref": "#/components/responses/BadRequest"
            }
          }
        }
      },
      "/topics/{cacheName}/{topicName}": {
        "parameters": [
          {
            "$ref": "#/components/parameters/cacheName"
          },
          {
            "$ref": "#/components/parameters/topicName"
          }
        ],
        "post": {
          "operationId": "topicPublish",
          "summary": "Publish data to a topic",
          "requestBody": {
            "required": true,
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string"
                }
              }
            }
          },
          "responses": {
            "204": {
              "$ref": "#/components/responses/NoContent"
            },
            "400": {
              "$ref": "#/components/responses/BadRequest"
            }
          }
        }
      }
    },
    "components": {
      "parameters": {
        "cacheName": {
          "name": "cacheName",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string",
            "minLength": 1,
            "example": "myfirstcache"
          }
        },
        "key": {
          "name": "key",
          "in": "query",
          "required": false,
          "schema": {
            "type": "string",
            "minLength": 1
          }
        },
        "key_base64": {
          "name": "key_base64",
          "in": "query",
          "required": false,
          "schema": {
            "type": "string",
            "minLength": 1
          }
        },
        "topicName": {
          "name": "topicName",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string",
            "minLength": 1,
            "example": "myfirstcache"
          }
        }
      },
      "responses": {
        "NoContent": {
          "description": "The operation was successful and no information was returned"
        },
        "BadRequest": {
          "description": "Data provided by the caller is invalid",
          "content": {
            "application/json": {
              "schema": {
                "properties": {
                  "status": {
                    "type": "integer"
                  },
                  "title": {
                    "type": "string"
                  },
                  "description": {
                    "type": "string"
                  }
                }
              }
            }
          }
        }
      },
      "securitySchemes": {
        "apiTokenQuery": {
          "type": "apiKey",
          "in": "query",
          "name": "token"
        },
        "apiTokenHeader": {
          "type": "apiKey",
          "in": "header",
          "name": "Authorization"
        }
      }
    }
  };
};