import fs from 'fs';
fs.writeFileSync('env.log', JSON.stringify(process.env, null, 2));
