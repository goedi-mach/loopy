const fs = require('fs');

const config = `const CONFIG = {
  SUPABASE_URL:        '${process.env.SUPABASE_URL}',
  SUPABASE_ANON_KEY:   '${process.env.SUPABASE_ANON_KEY}',
  VET_LICENSE_ANA:     '${process.env.VET_LICENSE_ANA || ''}',
  VET_LICENSE_FRIEDMAN:'${process.env.VET_LICENSE_FRIEDMAN || ''}'
};`;

fs.writeFileSync('config.js', config);
console.log('config.js generated');