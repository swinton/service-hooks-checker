const octokit = require('@octokit/rest')();
const jsonwebtoken = require('jsonwebtoken');
const config = require('./config');
const logger = require('./logger');

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
  const reposWithHooks = await Promise.all(
    repos.map(async repo => {
      // List hooks
      // GET /repos/:owner/:repo/hooks
      logger.info(`Getting hooks for "${repo}" repo...`);
      const hooksForRepo = octokit.repos.listHooks.endpoint.merge({
        owner: config.github.app.installation.organization.name,
        repo
      });
      const hooks = await octokit.paginate(hooksForRepo);
      return { repo, hooks };
    })
  );

  // Filter out "web" hooks
  logger.info(`Filtering out "web" repo hooks...`);
  let reposWithServiceHooks = reposWithHooks.map(repo => {
    repo.hooks = repo.hooks.filter(hook => hook.name !== 'web');
    return repo;
  });

  // Filter out repos with "no" hooks
  logger.info(`Filtering out repos with "no" hooks...`);
  reposWithServiceHooks = reposWithServiceHooks.filter(repo => repo.hooks.length > 0);

  console.log('%j', reposWithServiceHooks);
})();
