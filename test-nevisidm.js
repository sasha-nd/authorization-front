const https = require('https');

// Use environment variables for credentials. Falls back to NEVIS_CLIENT_* if IdM-specific
// env vars are not present.
const clientId = process.env.NEVISIDM_CLIENT_ID || process.env.NEVIS_CLIENT_ID;
const clientSecret = process.env.NEVISIDM_CLIENT_SECRET || process.env.NEVIS_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('Missing NEVISIDM_CLIENT_ID / NEVISIDM_CLIENT_SECRET (or NEVIS_CLIENT_ID / NEVIS_CLIENT_SECRET) in environment');
  process.exit(1);
}

const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

const tokenReq = https.request({
  hostname: 'login.national-digital.getnevis.net',
  path: '/oauth/token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${auth}`
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const token = JSON.parse(data).access_token;
    console.log('Testing NevisIDM endpoints:\n');
    
    // Test 1: GET with limit param
    https.request({
      hostname: 'api.national-digital.getnevis.net',
      path: '/nevisidm/api/core/v1/NDG/users?limit=5',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    }, r => {
      console.log(`GET /nevisidm/api/core/v1/NDG/users?limit=5 -> ${r.statusCode}`);
    }).end();
    
    // Test 2: POST search
    const req2 = https.request({
      hostname: 'api.national-digital.getnevis.net',
      path: '/nevisidm/api/core/v1/NDG/users/search',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Content-Type': 'application/json' }
    }, r => {
      console.log(`POST /nevisidm/api/core/v1/NDG/users/search -> ${r.statusCode}`);
    });
    req2.write(JSON.stringify({ limit: 5 }));
    req2.end();
  });
});

tokenReq.write('grant_type=client_credentials&scope=nevis');
tokenReq.end();
