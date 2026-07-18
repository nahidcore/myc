// ============================================
// 100% FREE Piston API Configuration
// ============================================
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/nahidcore/myc/main/arafat.c';

export default async function handler(req, res) {
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
        const codeResponse = await fetch(GITHUB_RAW_URL, {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        if (!codeResponse.ok) {
            throw new Error(`GitHub fetch failed: ${codeResponse.statusText}`);
        }
        
        const code = await codeResponse.text();
        
        // Execute code using Piston API (FREE)
        const pistonResponse = await fetch('https://emkc.org/api/v2/piston/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                language: 'c',
                version: '10.2.0',
                files: [{
                    name: 'arafat.c',
                    content: code
                }],
                stdin: stdin || '',
                compile_timeout: 10000,
                run_timeout: 5000
            })
        });
        
        if (!pistonResponse.ok) {
            throw new Error(`Piston API error: ${pistonResponse.statusText}`);
        }
        
        const result = await pistonResponse.json();
        
        // Transform Piston response to match expected format
        const output = {
            stdout: result.run?.stdout || '',
            stderr: result.run?.stderr || '',
            compile_output: result.compile?.stderr || '',
            message: result.run?.signal || '',
            time: result.run?.time || 0,
            memory: result.run?.memory || 0,
            status: {
                id: result.run?.code === 0 ? 3 : 6,
                description: result.run?.code === 0 ? 'Accepted' : 'Runtime Error'
            }
        };
        
        // Handle compilation error
        if (result.compile?.code !== 0 && result.compile?.stderr) {
            output.status = {
                id: 6,
                description: 'Compilation Error'
            };
        }
        
        return res.status(200).json(output);
        
    } catch (error) {
        console.error('Execution Error:', error);
        return res.status(500).json({ 
            error: error.message || 'Internal server error',
            stderr: error.message,
            stdout: '',
            compile_output: '',
            message: error.message,
            time: 0,
            memory: 0,
            status: {
                id: 5,
                description: 'Internal Error'
            }
        });
    }
}