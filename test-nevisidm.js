const https = require('https');

const clientId = '16400b2c6b5696c619278e244b288b99';
const clientSecret = '7d7d48b5b76d9be08fb4d9ced2579a86';
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
