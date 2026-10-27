// The frontend Vercel project has its Root Directory set to frontend/.
// Reuse the repository routing rules so both Vercel projects stay in sync.
const { redirects, headers } = require('../vercel.json');

exports.config = {
  redirects,
  headers,
  rewrites: [
    { source: '/(.*)', destination: '/index.html' },
  ],
};
