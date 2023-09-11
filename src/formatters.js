function replaceBracketsWithAsterisk(path) {
  return path.replace(/\{[^}]+\}/g, '*');
}

function formatResourcePath(inputString) {
  return inputString.split('/').filter(Boolean).map(part => part.replace('*', '').charAt(0).toUpperCase() + part.slice(1)).join('');
}

function getResourceName(prefix, path, httpMethod){
  const resourcePath = formatResourcePath(path);
  return `${prefix}${resourcePath}${httpMethod.charAt(0).toUpperCase() + httpMethod.slice(1)}`;
}

module.exports = {
  replaceBracketsWithAsterisk,
  getResourceName
};