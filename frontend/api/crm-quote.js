'use strict';

// Disabled until an administrator configures a server-only Gemini API key,
// enables the feature and confirms the Gemini Free-tier prerequisite.
const { createHandler } = require('../lib/crm-quote');
module.exports = createHandler();
