require('dotenv').config();
const { findPrivateKey } = require('./private-key');

module.exports = {
  github: {
    app: {
      id: process.env.APP_ID,
      privateKey: findPrivateKey(),
      installation: {
        id: process.env.INSTALLATION_ID,
        organization: {
          name: process.env.ORG_NAME
        }
      }
    }
  }
};
