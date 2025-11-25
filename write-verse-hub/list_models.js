import 'dotenv/config';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Please provide GEMINI_API_KEY in .env');
  process.exit(1);
}

async function listModels(version) {
  try {
    console.log(`\n--- Listing models for version: ${version} ---`);
    const response = await fetch(`https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}`);
    
    if (!response.ok) {
        console.error(`Error ${response.status}: ${response.statusText}`);
        const text = await response.text();
        console.error("Details:", text);
        return;
    }

    const data = await response.json();
    
    if (data.models) {
      console.log(`Found ${data.models.length} models.`);
      data.models.forEach(m => {
        if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')) {
           console.log(`- ${m.name.replace('models/', '')} (${m.displayName})`);
        }
      });
    } else {
      console.log('No models found in response:', data);
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

async function main() {
    await listModels('v1beta');
    await listModels('v1');
}

main();
