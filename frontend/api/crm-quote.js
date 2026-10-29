'use strict';

// Both switches are server-only. Nothing is enabled until an administrator
// explicitly configures the feature and deploys with an OpenAI API key.
const { createHandler } = require('../lib/crm-quote');
module.exports = createHandler();
