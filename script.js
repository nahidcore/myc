// ============================================
// Wait for DOM to be fully loaded
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // ============================================
    // Constants & Configuration
    // ============================================
    const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/nahidcore/myc/main/arafat.c';
    const API_ENDPOINT = '/api/run';
    const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

    // ============================================
    // DOM Elements
    // ============================================
    const elements = {
        codeDisplay: document.getElementById('code-display'),
        lineNumbers: document.getElementById('line-numbers'),
        fileNameDisplay: document.getElementById('file-name-display'),
        fetchStatus: document.getElementById('fetch-status'),
        stdinInput: document.getElementById('stdin-input'),
        runButton: document.getElementById('run-btn'),
        terminalBody: document.getElementById('terminal-body'),
        lastRunTime: document.getElementById('last-run-time'),
        loadingOverlay: document.getElementById('loading-overlay'),
        toastContainer: document.getElementById('toast-container'),
        historyList: document.getElementById('history-list'),
        copyBtn: document.getElementById('copy-btn'),
        downloadBtn: document.getElementById('download-btn'),
        refreshBtn: document.getElementById('refresh-btn'),
        autoRefreshBtn: document.getElementById('auto-refresh-btn'),
        clearHistoryBtn: document.getElementById('clear-history-btn')
    };

    // ============================================
    // State Management
    // ============================================
    let currentCode = '';
    let isAutoRefreshEnabled = false;
    let autoRefreshInterval = null;

    // ============================================
    // Toast Notification System
    // ============================================
    function showToast(message, type = 'info', duration = 3000) {
        try {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            
            const icons = {
                success: '✓',
                error: '✗',
                info: 'ℹ'
            };
            
            toast.innerHTML = `
                <span>${icons[type] || 'ℹ'}</span>
                <span>${message}</span>
            `;
            
            if (elements.toastContainer) {
                elements.toastContainer.appendChild(toast);
                
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.style.animation = 'slideOut 0.3s ease-out';
                        setTimeout(() => {
                            if (toast.parentNode) {
                                toast.remove();
                            }
                        }, 300);
                    }
                }, duration);
            }
        } catch (error) {
            console.log('Toast error:', error);
        }
    }

    // ============================================
    // Code Fetching & Display
    // ============================================
    async function fetchCodeFromGitHub() {
        try {
            if (!elements.fetchStatus || !elements.codeDisplay || !elements.lineNumbers) {
                console.error('Required DOM elements not found');
                return null;
            }

            elements.fetchStatus.textContent = 'Fetching...';
            elements.fetchStatus.className = 'status-badge';
            
            const response = await fetch(GITHUB_RAW_URL, {
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch code: ${response.status} ${response.statusText}`);
            }
            
            const code = await response.text();
            currentCode = code;
            
            displayCode(code);
            updateLineNumbers(code);
            
            elements.fetchStatus.textContent = '✓ Latest';
            elements.fetchStatus.className = 'status-badge success';
            
            return code;
        } catch (error) {
            console.error('Error fetching code:', error);
            
            if (elements.fetchStatus) {
                elements.fetchStatus.textContent = '⚠ Error';
                elements.fetchStatus.className = 'status-badge error';
            }
            
            showToast('Failed to fetch code from GitHub', 'error');
            return null;
        }
    }

    function displayCode(code) {
        if (!elements.codeDisplay) return;
        
        // Clear previous code
        elements.codeDisplay.textContent = code;
        
        // Apply syntax highlighting
        if (typeof hljs !== 'undefined' && hljs.highlightElement) {
            try {
                hljs.highlightElement(elements.codeDisplay);
            } catch (error) {
                console.log('Highlight.js error:', error);
            }
        }
    }

    function updateLineNumbers(code) {
        if (!elements.lineNumbers) return;
        
        const lines = code.split('\n');
        const lineCount = lines.length;
        
        let lineNumbersHTML = '';
        for (let i = 1; i <= lineCount; i++) {
            lineNumbersHTML += `${i}\n`;
        }
        
        elements.lineNumbers.textContent = lineNumbersHTML;
    }

    // ============================================
    // Copy & Download Functions
    // ============================================
    function copyCodeToClipboard() {
        if (!currentCode) {
            showToast('No code to copy', 'error');
            return;
        }
        
        navigator.clipboard.writeText(currentCode).then(() => {
            showToast('Code copied to clipboard!', 'success');
        }).catch(() => {
            showToast('Failed to copy code', 'error');
        });
    }

    function downloadCode() {
        if (!currentCode) {
            showToast('No code to download', 'error');
            return;
        }
        
        try {
            const blob = new Blob([currentCode], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'arafat.c';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showToast('Code downloaded successfully!', 'success');
        } catch (error) {
            showToast('Download failed', 'error');
        }
    }

    // ============================================
    // Run History Management
    // ============================================
    function loadHistory() {
        try {
            const history = JSON.parse(localStorage.getItem('runHistory') || '[]');
            return history;
        } catch {
            return [];
        }
    }

    function saveHistory(entry) {
        try {
            const history = loadHistory();
            history.unshift(entry);
            
            // Keep only last 50 entries
            if (history.length > 50) {
                history.pop();
            }
            
            localStorage.setItem('runHistory', JSON.stringify(history));
            displayHistory();
        } catch (error) {
            console.log('Save history error:', error);
        }
    }

    function clearHistory() {
        localStorage.removeItem('runHistory');
        displayHistory();
        showToast('History cleared', 'info');
    }

    function displayHistory() {
        if (!elements.historyList) return;
        
        const history = loadHistory();
        
        if (history.length === 0) {
            elements.historyList.innerHTML = '<div class="history-empty">No runs yet</div>';
            return;
        }
        
        elements.historyList.innerHTML = history.map((entry, index) => `
            <div class="history-item" onclick="loadHistoryEntry(${index})" style="cursor: pointer;">
                <div class="history-item-header">
                    <span class="history-time">${entry.timestamp || 'Unknown'}</span>
                    <span class="history-status ${entry.success ? 'success' : 'error'}">
                        ${entry.success ? 'Success' : 'Error'}
                    </span>
                </div>
                <div class="history-output">${(entry.output || '').substring(0, 200)}</div>
            </div>
        `).join('');
    }

    window.loadHistoryEntry = function(index) {
        try {
            const history = loadHistory();
            const entry = history[index];
            
            if (entry) {
                if (elements.stdinInput) elements.stdinInput.value = entry.input || '';
                if (elements.terminalBody) elements.terminalBody.innerHTML = entry.output || '';
            }
        } catch (error) {
            console.log('Load history entry error:', error);
        }
    };

    // ============================================
    // Code Execution
    // ============================================
    async function runCode() {
        if (!currentCode) {
            showToast('No code loaded. Please refresh the code first.', 'error');
            return;
        }
        
        const stdin = elements.stdinInput ? elements.stdinInput.value : '';
        
        // Disable run button
        if (elements.runButton) elements.runButton.disabled = true;
        if (elements.loadingOverlay) elements.loadingOverlay.classList.remove('hidden');
        
        try {
            const startTime = Date.now();
            
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ stdin })
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            const endTime = Date.now();
            const executionTime = ((endTime - startTime) / 1000).toFixed(2);
            
            // Display output
            displayOutput(result, executionTime);
            
            // Save to history
            saveHistory({
                timestamp: new Date().toLocaleString(),
                input: stdin,
                output: elements.terminalBody ? elements.terminalBody.innerHTML : '',
                success: result.status && result.status.id === 3,
                executionTime
            });
            
            // Update last run time
            if (elements.lastRunTime) {
                elements.lastRunTime.textContent = `Last run: ${executionTime}s`;
            }
            
        } catch (error) {
            console.error('Error running code:', error);
            
            if (elements.terminalBody) {
                elements.terminalBody.innerHTML = `
                    <div style="color: var(--accent-red);">
                        <strong>Error:</strong> ${error.message}
                    </div>
                `;
            }
            
            showToast('Failed to execute code', 'error');
            
            // Save error to history
            saveHistory({
                timestamp: new Date().toLocaleString(),
                input: stdin,
                output: elements.terminalBody ? elements.terminalBody.innerHTML : error.message,
                success: false,
                executionTime: '0.00'
            });
            
        } finally {
            // Re-enable run button
            if (elements.runButton) elements.runButton.disabled = false;
            if (elements.loadingOverlay) elements.loadingOverlay.classList.add('hidden');
        }
    }

    function displayOutput(result, executionTime) {
        if (!elements.terminalBody) return;
        
        let outputHTML = '';
        
        // Check for compilation errors
        if (result.compile_output) {
            outputHTML += `
                <div style="color: var(--accent-yellow); margin-bottom: 12px;">
                    <strong>⚠ Compilation Error:</strong>
                </div>
                <div style="color: var(--accent-red); margin-bottom: 12px;">
                    ${escapeHtml(result.compile_output)}
                </div>
            `;
        }
        
        // Check for runtime errors
        if (result.stderr) {
            outputHTML += `
                <div style="color: var(--accent-yellow); margin-bottom: 12px;">
                    <strong>⚠ Runtime Error:</strong>
                </div>
                <div style="color: var(--accent-red); margin-bottom: 12px;">
                    ${escapeHtml(result.stderr)}
                </div>
            `;
        }
        
        // Display standard output
        if (result.stdout) {
            outputHTML += `
                <div style="color: var(--accent-green); margin-bottom: 8px;">
                    <strong>Output:</strong>
                </div>
                <div style="color: var(--text-primary);">
                    ${escapeHtml(result.stdout)}
                </div>
            `;
        }
        
        // Status information
        if (result.status) {
            let statusColor = 'var(--accent-green)';
            if (result.status.id !== 3) {
                statusColor = 'var(--accent-red)';
            }
            
            outputHTML += `
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color); font-size: 12px; color: var(--text-secondary);">
                    <span style="color: ${statusColor}; font-weight: 500;">
                        Status: ${result.status.description || 'Unknown'}
                    </span>
                    ${result.time ? ` | Time: ${result.time}s` : ''}
                    ${result.memory ? ` | Memory: ${Math.round(result.memory / 1024)} MB` : ''}
                    <br>
                    Execution Time: ${executionTime}s
                </div>
            `;
        }
        
        // Error handling for Judge0 specific errors
        if (result.message) {
            outputHTML += `
                <div style="color: var(--accent-red); margin-top: 8px;">
                    ${escapeHtml(result.message)}
                </div>
            `;
        }
        
        elements.terminalBody.innerHTML = outputHTML || '<div style="color: var(--text-secondary);">No output</div>';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    // ============================================
    // Auto Refresh
    // ============================================
    function toggleAutoRefresh() {
        isAutoRefreshEnabled = !isAutoRefreshEnabled;
        
        if (isAutoRefreshEnabled) {
            if (elements.autoRefreshBtn) {
                elements.autoRefreshBtn.style.color = 'var(--accent-green)';
                elements.autoRefreshBtn.style.borderColor = 'var(--accent-green)';
            }
            autoRefreshInterval = setInterval(fetchCodeFromGitHub, AUTO_REFRESH_INTERVAL);
            showToast('Auto-refresh enabled', 'info');
        } else {
            if (elements.autoRefreshBtn) {
                elements.autoRefreshBtn.style.color = '';
                elements.autoRefreshBtn.style.borderColor = '';
            }
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
            }
            showToast('Auto-refresh disabled', 'info');
        }
    }

    // ============================================
    // Event Listeners
    // ============================================
    function setupEventListeners() {
        // Run button
        if (elements.runButton) {
            elements.runButton.addEventListener('click', runCode);
        }
        
        // Copy button
        if (elements.copyBtn) {
            elements.copyBtn.addEventListener('click', copyCodeToClipboard);
        }
        
        // Download button
        if (elements.downloadBtn) {
            elements.downloadBtn.addEventListener('click', downloadCode);
        }
        
        // Refresh button
        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', fetchCodeFromGitHub);
        }
        
        // Auto refresh button
        if (elements.autoRefreshBtn) {
            elements.autoRefreshBtn.addEventListener('click', toggleAutoRefresh);
        }
        
        // Clear history button
        if (elements.clearHistoryBtn) {
            elements.clearHistoryBtn.addEventListener('click', clearHistory);
        }
        
        // Keyboard shortcut: Ctrl + Enter to run code
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                runCode();
            }
        });
    }

    // ============================================
    // Initialization
    // ============================================
    async function init() {
        try {
            setupEventListeners();
            displayHistory();
            
            // Set initial terminal message
            if (elements.terminalBody) {
                elements.terminalBody.innerHTML = `
                    <div class="terminal-placeholder">
                        <span style="color: var(--text-secondary);">Ready to run code...</span>
                        <br>
                        <span style="font-size: 12px; color: var(--text-secondary);">
                            Press <span style="color: var(--accent-blue);">Ctrl + Enter</span> to execute
                        </span>
                    </div>
                `;
            }
            
            // Fetch initial code
            await fetchCodeFromGitHub();
            showToast('Code loaded successfully!', 'success');
            
            console.log('My C Runner initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            showToast('Failed to initialize', 'error');
        }
    }

    // Start the application
    init();
});