const core = require('@actions/core');
const yaml = require('js-yaml');
const fs = require('fs');
const { buildTemplateFromSpec} = require('./resources');

const specPath = process.env.INPUT_SPECPATH;
const blueprint = process.env.INPUT_BLUEPRINT;
const resourcePrefix = process.env.RESOURCEPREFIX ?? '';
const outputFilename = process.env.OUTPUTFILENAME ?? 'template.yaml';

if (!process.env.INPUT_HTTPMETHODS) {
  process.env.INPUT_HTTPMETHODS = 'PUT,POST,PATCH,DELETE';
}
const supportedMethods = new Set(process.env.INPUT_HTTPMETHODS.split(',').map(method => method.trim().toUpperCase()));

try {
  const doc = yaml.load(fs.readFileSync(specPath, 'utf8'));
  const template = buildTemplateFromSpec(doc, supportedMethods, resourcePrefix, blueprint);

  fs.writeFileSync(outputFilename, yaml.dump(template));

  core.info('Successfully transformed API spec');
  core.setOutput('template-path', outputFilename);
} catch (e) {
  console.error(e);
  core.setFailed('Something went wrong processing your API spec');
}
