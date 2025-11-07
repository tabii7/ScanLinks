require('dotenv').config({ path: '.env' });
const axios = require('axios');
const fs = require('fs');

async function testKeySegments() {
  const env = fs.readFileSync('.env', 'utf8');
  const match = env.match(/OPENAI_API_KEY=(.+)/);
  
  if (!match) {
    console.log('❌ OPENAI_API_KEY not found in .env');
    return;
  }
  
  const fullKey = match[1].trim();
  console.log('🔍 Testing different key segments from 164-character key...\n');
  
  // Test different segments
  const segments = [
    { name: 'First 51 chars (standard length)', key: fullKey.substring(0, 51) },
    { name: 'First 60 chars', key: fullKey.substring(0, 60) },
    { name: 'First 70 chars', key: fullKey.substring(0, 70) },
    { name: 'Chars 50-100', key: fullKey.substring(50, 100) },
    { name: 'Chars 100-151', key: fullKey.substring(100, 151) },
    { name: 'Full 164 chars', key: fullKey }
  ];
  
  for (const seg of segments) {
    if (seg.key.length < 40) continue;
    
    console.log(`\nTesting: ${seg.name} (length: ${seg.key.length})`);
    console.log(`  Preview: ${seg.key.substring(0, 10)}...${seg.key.substring(seg.key.length - 5)}`);
    
    try {
      const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Say "test" and nothing else.' }],
          max_tokens: 5
        },
        {
          headers: {
            'Authorization': `Bearer ${seg.key}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      
      console.log(`  ✅✅✅ VALID! This segment works!`);
      console.log(`  Response: ${res.data.choices[0]?.message?.content}`);
      console.log(`\n✅ Use this key in your .env file:`);
      console.log(`OPENAI_API_KEY=${seg.key}`);
      return seg.key;
    } catch (err) {
      if (err.response?.status === 401) {
        console.log(`  ❌ Invalid (401 - Authentication failed)`);
      } else if (err.response?.status === 429) {
        console.log(`  ⚠️ Rate limit (429 - but key might be valid)`);
      } else {
        console.log(`  ❌ Error: ${err.message}`);
      }
    }
  }
  
  console.log('\n❌ None of the segments worked. Please check your OpenAI API key.');
  console.log('   Get a new key from: https://platform.openai.com/account/api-keys');
}

testKeySegments();

