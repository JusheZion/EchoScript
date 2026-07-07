async function test() {
  const fileId = '456';
  
  for (let i = 0; i < 2; i++) {
    const formData = new FormData();
    formData.append('chunk', new Blob(['hello ' + i]), 'test.txt');
    formData.append('fileId', fileId);
    formData.append('chunkIndex', i.toString());
    formData.append('totalChunks', '2');
    
    try {
      const res = await fetch('http://localhost:3000/api/upload-chunk', {
        method: 'POST',
        body: formData,
      });
      console.log(`Chunk ${i}:`, res.status, await res.text());
    } catch (e: any) {
      console.log(`Chunk ${i} error:`, e.message);
    }
  }
}
test();
