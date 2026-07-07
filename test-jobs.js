fetch('http://localhost:3000/api/health')
.then(() => console.log('alive'))
.catch(e => console.error(e));
