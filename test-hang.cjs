const fs = require('fs');
async function test() {
  const writeStream = fs.createWriteStream('test.txt');
  writeStream.write('hello');
  writeStream.end();
  // Simulate some microtask delay
  await Promise.resolve();
  await new Promise((resolve) => {
    writeStream.on('finish', () => { console.log('finished!'); resolve(); });
    writeStream.on('close', () => { console.log('closed!'); resolve(); });
  });
  console.log('done');
}
test();
