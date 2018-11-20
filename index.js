const octokit = require('@octokit/rest')();
const jsonwebtoken = require('jsonwebtoken');
const config = require('./config');

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
  const installation = await octokit.apps.findOrgInstallation({
    org: config.github.app.installation.organization.name
  });

  // Create a new installation token
  // https://developer.github.com/v3/apps/#create-a-new-installation-token
  const token = await octokit.apps.createInstallationToken({
    installation_id: installation.data.id
  });

  octokit.authenticate({
    type: 'token',
    token: token.data.token
  });

  // Lookup organization repos
  const reposForOrg = octokit.repos.listForOrg.endpoint.merge({
    org: config.github.app.installation.organization.name
  });
  const repos = await octokit.paginate(reposForOrg, response => response.data.map(repo => repo.name));

  // Lookup repos with service hooks
  const reposWithHooks = repos.map(repo => {
    // List hooks
    // GET /repos/:owner/:repo/hooks
    const hooksForRepo = octokit.repos.listHooks.endpoint.merge({
      owner: config.github.app.installation.organization.name,
      repo
    });
    return { [repo]: octokit.paginate(hooksForRepo, response => response.data.map(hook => hook.name)) };
  });
  console.log('reposWithHooks: %j', reposWithHooks);
})();
