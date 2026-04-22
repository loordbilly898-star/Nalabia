import fetch from 'node-fetch';

async function test() {
  const res = await fetch('https://www.nalabia.com.br/api/ai/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      model: "mistral-large-latest",
      messages: [{role: 'user', content: 'hi'}] 
    })
  });
  console.log('STATUS:', res.status);
  console.log('HEADERS:', res.headers.raw());
  
  if (res.headers.get('content-type')?.includes('event-stream')) {
    console.log('STREAM STARTED');
    const reader = res.body;
    reader.on('data', chunk => process.stdout.write('.'));
    reader.on('end', () => console.log('\nSTREAM ENDED'));
  }
}

test();
