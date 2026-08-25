fetch('http://localhost:3000/api/audio-proxy?url=%2Fchime-1.mp3').then(r => {
  console.log(r.status, r.headers.get('content-type'));
}).catch(console.error);
