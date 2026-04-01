const fs = require('fs');

const config = `const CONFIG = {
  SUPABASE_URL:      '${process.env.SUPABASE_URL}',
  SUPABASE_ANON_KEY: '${process.env.SUPABASE_ANON_KEY}'
};`;

fs.writeFileSync('config.js', config);
console.log('config.js generated');