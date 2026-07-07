const fs = require('fs');
async function test() {
  const writeStream = fs.createWriteStream('test.txt');
  writeStream.write('hello');
  writeStream.end();
  await new Promise((resolve) => {
    writeStream.on('finish', () => { console.log('finished!'); resolve(); });
  });
  console.log('done');
}
test();
