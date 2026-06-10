const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

(async () => {
  try {
    const planUrl = 'http://localhost:3000/api/plan?start=14.6015,121.0696&end=14.6211,121.0493';
    const featUrl = 'http://localhost:3000/api/feature?file=lrt2_line_sample.geojson&id=lrt2_sample';

    console.log('Requesting plan...');
    const plan = await get(planUrl);
    console.log('Plan status:', plan.statusCode);
    console.log(JSON.stringify(JSON.parse(plan.body), null, 2));

    console.log('\nRequesting feature...');
    const feat = await get(featUrl);
    console.log('Feature status:', feat.statusCode);
    console.log(JSON.stringify(JSON.parse(feat.body), null, 2));

    console.log('\nSmoke test completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Smoke test failed:', err);
    process.exit(1);
  }
})();
