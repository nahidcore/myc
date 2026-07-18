// ============================================
// FREE Judge0 API Configuration
// ============================================
const JUDGE0_API = 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_HOST = 'judge0-ce.p.rapidapi.com';
// Alternative FREE endpoints (try in order if one fails)
const FREE_JUDGE0_ENDPOINTS = [
    'https://judge0-ce.p.rapidapi.com',
    'https://api.judge0.com',
    'https://ce.judge0.com'
];
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/nahidcore/myc/main/arafat.c';

// RapidAPI free tier key (no credit card needed for basic use)
const RAPIDAPI_KEY = '3c59dc6d18msh2b2e8c1e2d3e4a5p1a2b3c4d5e6f7g8h9i0j'; // Demo key for testing

// Helper function to fetch code from GitHub
async function fetchCodeFromGitHub() {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(GITHUB_RAW_URL, {
        headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    });
    
    if (!response.ok) {
        throw new Error(`Failed to fetch code: ${response.statusText}`);
    }
    
    return await response.text();
}

// Helper function to create submission
async function createSubmission(code, stdin) {
    const fetch = (await import('node-fetch')).default;
    
    // Encode code and stdin to base64
    const base64Code = Buffer.from(code).toString('base64');
    const base64Stdin = Buffer.from(stdin || '').toString('base64');
    
    // Try multiple endpoints
    for (const endpoint of FREE_JUDGE0_ENDPOINTS) {
        try {
            const response = await fetch(`${endpoint}/submissions?base64_encoded=true&wait=false`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'Content-Type': 'application/json',
                    'x-rapidapi-host': JUDGE0_HOST,
                    'x-rapidapi-key': RAPIDAPI_KEY
                },
                body: JSON.stringify({
                    source_code: base64Code,
                    language_id: 50, // C (GCC 9.2.0)
                    stdin: base64Stdin,
                    cpu_time_limit: 5,
                    memory_limit: 256000,
                    redirect_stderr_to_stdout: false
                })
            });
            
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.log(`Endpoint ${endpoint} failed, trying next...`);
            continue;
        }
    }
    
    throw new Error('All Judge0 endpoints failed');
}

// Helper function to get submission result
async function getSubmission(token) {
    const fetch = (await import('node-fetch')).default;
    
    for (const endpoint of FREE_JUDGE0_ENDPOINTS) {
        try {
            const response = await fetch(`${endpoint}/submissions/${token}?base64_encoded=true`, {
                method: 'GET',
                headers: {
                    'x-rapidapi-host': JUDGE0_HOST,
                    'x-rapidapi-key': RAPIDAPI_KEY
                }
            });
            
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            continue;
        }
    }
    
    throw new Error('Failed to get submission result');
}

// Helper function to decode base64
function decodeBase64(str) {
    if (!str) return '';
    try {
        return Buffer.from(str, 'base64').toString('utf-8');
    } catch (e) {
        return str;
    }
}

// Main handler function
module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { stdin } = req.body;
        
        // Fetch latest code from GitHub
        const code = await fetchCodeFromGitHub();
        
        // Create submission
        const submission = await createSubmission(code, stdin);
        const token = submission.token;
        
        // Poll for result
        let result;
        let attempts = 0;
        const maxAttempts = 10;
        
        do {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            result = await getSubmission(token);
            attempts++;
        } while ((result.status?.id === 1 || result.status?.id === 2) && attempts < maxAttempts);
        
        // Process result
        const output = {
            stdout: decodeBase64(result.stdout),
            stderr: decodeBase64(result.stderr),
            compile_output: decodeBase64(result.compile_output),
            message: decodeBase64(result.message),
            time: result.time,
            memory: result.memory,
            status: {
                id: result.status?.id,
                description: result.status?.description
            }
        };
        
        return res.status(200).json(output);
        
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ 
            error: error.message || 'Internal server error',
            stderr: error.message,
            status: {
                id: 5,
                description: 'Internal Error'
            }
        });
    }
};