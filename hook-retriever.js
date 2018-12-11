function* generator(owner, repos, octokit, logger) {
  for (const repo of repos) {
    const hooksForRepo = octokit.repos.listHooks.endpoint.merge({
      owner,
      repo
    });
    yield octokit.paginate(hooksForRepo).then(data => ({ repo, hooks: data }));
  }
}

module.exports = generator;
