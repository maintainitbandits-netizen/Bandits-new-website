'use strict';

// The primary Vercel project is rooted in frontend/. The routing keys are
// server-only environment variables, not React/CRM build-time variables.
const { createHandler } = require('../lib/crm-route');
module.exports = createHandler();
