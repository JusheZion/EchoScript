async function test() {
  const formData = new FormData();
  formData.append('chunk', new Blob(['hello']), 'test.txt');
  formData.append('fileId', '123');
  formData.append('chunkIndex', '0');
  
  const res = await fetch('http://localhost:3000/api/upload-chunk', {
    method: 'POST',
    body: formData,
  });
  console.log(res.status, await res.text());
}
test();
