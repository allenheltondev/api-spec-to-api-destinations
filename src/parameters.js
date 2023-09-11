function loadQueryParams(definition) {
  const parameters = definition.components?.parameters;
  if (!parameters) {
    return [];
  }
  const queryParams = [];
  for (const [key, value] of Object.entries(parameters)) {
    if (value?.in?.toLowerCase() == 'query') {
      queryParams.push({ parameterName: key, valueName: value.name });
    }
  }

  return queryParams;
};

function getDefinedQueryParams(definition, queryParams) {
  const endpointQueryParams = {};
  if (definition.parameters) {
    for (const param of definition.parameters) {
      if (param['$ref']) {
        const paramParts = param['$ref'].split('/');
        const paramName = paramParts[paramParts.length - 1];
        const queryParam = queryParams.find(p => p.parameterName == paramName);
        if (queryParam) {
          endpointQueryParams[queryParam.valueName] = `$.detail.${queryParam.valueName}`;
        }
      } else {
        if (param.in?.toLowerCase() == 'query') {
          endpointQueryParams[param.name] = `$.detail.${param.name}`;
        }
      }
    }
  }

  return endpointQueryParams;
};

module.exports = {
  loadQueryParams,
  getDefinedQueryParams
};