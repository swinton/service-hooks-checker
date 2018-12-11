const octokit = require('@octokit/rest')();
const jsonwebtoken = require('jsonwebtoken');
const PromisePool = require('es6-promise-pool');
const config = require('./config');
const logger = require('./logger');
const hookRetriever = require('./hook-retriever');

(async () => {
  // Authenticate as GitHub App
  const jwt = jsonwebtoken.sign(
    {
      iat: Math.floor(Date.now() / 1000), // Issued at time
      exp: Math.floor(Date.now() / 1000) + 60, // JWT expiration time
      iss: config.github.app.id // GitHub App ID
    },
    config.github.app.privateKey,
    { algorithm: 'RS256' }
  );

  octokit.authenticate({
    type: 'app',
    token: jwt
  });

  // Find organization installation
  // https://developer.github.com/v3/apps/#find-organization-installation
  // GET /orgs/:org/installation
  logger.info(`Looking up installation for ${config.github.app.installation.organization.name}...`);
  const installation = await octokit.apps.findOrgInstallation({
    org: config.github.app.installation.organization.name
  });
  logger.info(`Found installation id ${installation.data.id}`);

  // Create a new installation token
  // https://developer.github.com/v3/apps/#create-a-new-installation-token
  logger.info(`Generating installation token`);
  const token = await octokit.apps.createInstallationToken({
    installation_id: installation.data.id
  });

  octokit.authenticate({
    type: 'token',
    token: token.data.token
  });

  // Lookup organization repos
  logger.info(`Getting all repos...`);
  const reposForOrg = octokit.repos.listForOrg.endpoint.merge({
    org: config.github.app.installation.organization.name
  });
  const repos = await octokit.paginate(reposForOrg, response => response.data.map(repo => repo.name));
  logger.info(`Found ${repos.length} repos`);

  // Lookup repos with service hooks
  // Use a promise pool to limit concurrency
  const promiseIterator = hookRetriever(config.github.app.installation.organization.name, repos, octokit, logger);
  const pool = new PromisePool(promiseIterator, 3);
  const reposWithHooks = [];
  pool.addEventListener('fulfilled', event => {
    if (event.data.result.hooks.length > 0) {
      logger.info(`Got ${event.data.result.hooks.length} hooks for "${event.data.result.repo}" repo...`);
      reposWithHooks.push(event.data.result);
    }
  });
  await pool.start();

  // Filter out "web" hooks
  logger.info(`Filtering out "web" repo hooks...`);
  const reposWithServiceHooks = reposWithHooks.map(repo => {
    repo.hooks = repo.hooks.filter(hook => hook.name !== 'web');
    return repo;
  });

  console.log('%j', reposWithServiceHooks);
})();
