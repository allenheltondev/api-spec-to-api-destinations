# OpenAPI to EventBridge API Destinations GitHub Action

This GitHub Action parses an OpenAPI specification to generate an AWS CloudFormation template that contains EventBridge API Destinations and associated triggers.

## Usage

Add this action to your GitHub Actions workflow by referencing it:

```yaml
- name: Generate CloudFormation from OpenAPI spec
  uses: allenheltondev/openapi-to-eventbridge-action@v1
  with:
    specPath: path/to/openapi/spec.yml
    httpMethods: POST, DELETE, PUT
    resourcePrefix: MYAPP
    outputFilename: template.yaml
```

## Inputs

| Name            | Description                                                                                                      | Required |
|-----------------|------------------------------------------------------------------------------------------------------------------|----------|
| `specPath`      | Path to the OpenAPI spec.                                                                                        | ✅       |
| `blueprint`     | Path to template file you'd like to use as a basis. Useful if you have authentication parameters to provide.     | ❌       |
| `httpMethods`   | Comma-separated list of HTTP methods to convert to API Destinations (e.g. "GET,POST,PUT").                        | ❌       |
| `resourcePrefix`| Prefix to use for all generated resources.                                                                       | ❌       |
| `outputFilename`| The filename for the generated output. If not provided, a default name will be used.                              | ❌       |

## Outputs

- The action will generate an AWS CloudFormation template with the EventBridge API Destinations and associated triggers based on the provided OpenAPI spec.

## Example

Here's a simple example of how you might use this action:

```yaml
name: Generate EventBridge Resources

on:
  push:
    branches:
      - main

jobs:
  generate:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v2

    - name: Generate CloudFormation from OpenAPI spec
      uses: allenheltondev/openapi-to-eventbridge-action@v1
      with:
        specPath: openapi/spec.yml
        httpMethods: "GET,POST"
        resourcePrefix: "myApp_"
        outputFilename: "template.yaml"
```

## Contributing

If you'd like to contribute to the development of this GitHub Action, please create a pull request.

## License

[MIT](LICENSE) © [Allen Helton - Ready, Set, Cloud!]