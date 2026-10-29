'use strict';

// Disabled until an administrator configures the server-only Cloudflare
// credentials, enables the feature and confirms the Workers Free prerequisite.
const { createHandler } = require('../lib/crm-quote');
module.exports = createHandler();
