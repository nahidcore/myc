/* =========================================================
   My C Runner — script.js
   Vanilla JavaScript only. No frameworks.
   Handles: fetching arafat.c from GitHub, syntax highlighting,
   running code through /api/run (Judge0), history, shortcuts,
   copy/download, toasts, loading states.
   ========================================================= */

(() => {
  'use strict';

  /* ---------------- CONFIG ---------------- */
  const CONFIG = {
    GITHUB_USER: 'nahidcore',
    GITHUB_REPO: 'myc',
    GITHUB_BRANCH: 'main', // change to "master" if that is your default branch
    FILE_NAME: 'arafat.c',
    HISTORY_KEY: 'myc_run_history',
    HISTORY_LIMIT: 15
  };

  const rawUrl = () =>
    `https://raw.githubusercontent.com/${CONFIG.GITHUB_USER}/${CONFIG.GITHUB_REPO}/${CONFIG.GITHUB_BRANCH}/${CONFIG.FILE_NAME}?t=${Date.now()}`;

  /* ---------------- DOM REFS ---------------- */
  const el = {
    codeContent:   document.getElementById('codeContent'),
    fileName:      document.getElementById('fileName'),
    lastFetched:   document.getElementById('lastFetched'),
    connDot:       document.getElementById('connDot'),
    refreshBtn:    document.getElementById('refreshBtn'),
    copyBtn:       document.getElementById('copyBtn'),
    downloadBtn:   document.getElementById('downloadBtn'),
    stdinBox:      document.getElementById('stdinBox'),
    runBtn:        document.getElementById('runBtn'),
    runLabel:      document.getElementById('runLabel'),
    spinner:       document.getElementById('spinner'),
    outputBox:     document.getElementById('outputBox'),
    statusBadge:   document.getElementById('statusBadge'),
    lastRunTime:   document.getElementById('lastRunTime'),
    runStats:      document.getElementById('runStats'),
    historyList:   document.getElementById('historyList'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    toastContainer: document.getElementById('toastContainer')
  };

  /* current in-memory copy of the fetched source, used for copy/download */
  let currentSourceCode = '';
  let isRunning = false;

  /* =========================================================
     TOAST NOTIFICATIONS
     ========================================================= */
  function toast(message, type = 'info', duration = 3200) {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.textContent = message;
    el.toastContainer.appendChild(node);
    setTimeout(() => {
      node.style.opacity = '0';
      node.style.transition = 'opacity 0.25s ease';
      setTimeout(() => node.remove(), 250);
    }, duration);
  }

  /* =========================================================
     SIMPLE C SYNTAX HIGHLIGHTER (no external library)
     ========================================================= */
  const C_KEYWORDS = new Set([
    'if','else','for','while','do','switch','case','default','break',
    'continue','return','goto','sizeof','typedef','struct','union',
    'enum','static','extern','const','volatile','inline','register',
    'auto','void'
  ]);
  const C_TYPES = new Set([
    'int','float','double','char','long','short','unsigned','signed',
    'size_t','FILE','bool'
  ]);

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function highlightC(rawCode) {
    const escaped = escapeHtml(rawCode);

    // token regex: comments | strings/chars | preprocessor | numbers | identifiers
    const tokenRegex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(#\s*\w+[^\n]*)|(\b\d+\.?\d*[fFlLuU]*\b)|([A-Za-z_]\w*)(\s*\()?/g;

    return escaped.replace(
      tokenRegex,
      (match, comment, str, preproc, num, ident, followedByParen) => {
        if (comment) return `<span class="tok-com">${comment}</span>`;
        if (str) return `<span class="tok-str">${str}</span>`;
        if (preproc) return `<span class="tok-pre">${preproc}</span>`;
        if (num) return `<span class="tok-num">${num}</span>`;
        if (ident) {
          if (C_KEYWORDS.has(ident)) return `<span class="tok-kw">${ident}</span>`;
          if (C_TYPES.has(ident)) return `<span class="tok-type">${ident}</span>`;
          if (followedByParen) return `<span class="tok-func">${ident}</span>` + followedByParen;
          return ident;
        }
        return match;
      }
    );
  }

  /* =========================================================
     FETCH LATEST arafat.c FROM GITHUB
     ========================================================= */
  async function fetchCode(showToast = false) {
    el.codeContent.textContent = '// fetching latest arafat.c from GitHub...';
    try {
      const res = await fetch(rawUrl(), { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`GitHub returned HTTP ${res.status}`);
      }
      const code = await res.text();
      currentSourceCode = code;
      el.codeContent.innerHTML = highlightC(code);
      el.fileName.textContent = CONFIG.FILE_NAME;
      el.lastFetched.textContent = `synced ${new Date().toLocaleTimeString()}`;
      setConn(true);
      if (showToast) toast('Fetched latest arafat.c from GitHub', 'success');
    } catch (err) {
      setConn(false);
      el.codeContent.textContent = `// Failed to load ${CONFIG.FILE_NAME} from GitHub.\n// ${err.message}`;
      toast(`Could not fetch code: ${err.message}`, 'error');
    }
  }

  function setConn(online) {
    el.connDot.classList.toggle('online', online);
    el.connDot.classList.toggle('offline', !online);
  }

  /* =========================================================
     COPY / DOWNLOAD
     ========================================================= */
  async function copyCode() {
    if (!currentSourceCode) {
      toast('No code loaded yet', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(currentSourceCode);
      toast('Code copied to clipboard', 'success');
    } catch {
      // fallback for browsers/contexts without clipboard API permission
      const ta = document.createElement('textarea');
      ta.value = currentSourceCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('Code copied to clipboard', 'success');
    }
  }

  function downloadCode() {
    if (!currentSourceCode) {
      toast('No code loaded yet', 'error');
      return;
    }
    const blob = new Blob([currentSourceCode], { type: 'text/x-csrc' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = CONFIG.FILE_NAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`Downloaded ${CONFIG.FILE_NAME}`, 'success');
  }

  /* =========================================================
     RUN CODE  (calls our own /api/run serverless function)
     ========================================================= */
  function setRunning(running) {
    isRunning = running;
    el.runBtn.disabled = running;
    el.spinner.classList.toggle('hidden', !running);
    el.runLabel.textContent = running ? 'Running...' : 'Run';
    setStatusBadge(running ? 'running' : 'idle');
  }

  function setStatusBadge(kind, label) {
    const map = {
      idle:    ['status-idle', 'IDLE'],
      running: ['status-running', 'RUNNING'],
      success: ['status-success', 'SUCCESS'],
      error:   ['status-error', 'ERROR']
    };
    const [cls, text] = map[kind] || map.idle;
    el.statusBadge.className = `status-badge ${cls}`;
    el.statusBadge.textContent = label || text;
  }

  function renderOutput(text, kind = 'normal') {
    el.outputBox.innerHTML = '';
    const span = document.createElement('span');
    if (kind === 'error') span.className = 'output-error';
    if (kind === 'warn') span.className = 'output-warn';
    span.textContent = text;
    el.outputBox.appendChild(span);
  }

  async function runCode() {
    if (isRunning) return;
    setRunning(true);
    renderOutput('$ compiling and running arafat.c...');

    const stdin = el.stdinBox.value;
    const startedAt = Date.now();

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: stdin })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Server error (HTTP ${res.status})`);
      }

      handleRunResult(data, Date.now() - startedAt, stdin);
    } catch (err) {
      setStatusBadge('error');
      renderOutput(`✖ ${err.message}`, 'error');
      toast('Run failed: ' + err.message, 'error');
      saveHistory({
        time: new Date().toISOString(),
        status: 'error',
        statusLabel: 'Request Failed',
        input: stdin,
        output: err.message
      });
    } finally {
      setRunning(false);
      el.lastRunTime.textContent = `Last run: ${new Date().toLocaleString()}`;
    }
  }

  /* Maps Judge0 status + streams into a friendly terminal output */
  function handleRunResult(data, elapsedMs, stdin) {
    const { statusId, statusDescription, stdout, stderr, compileOutput, time, memory } = data;

    el.runStats.textContent = `${time ? time + 's cpu · ' : ''}${memory ? memory + 'KB · ' : ''}${elapsedMs}ms round-trip`;

    // Judge0 status ids: 3 = Accepted, 5 = TLE, 6 = Compilation Error, 11-14 = various runtime errors
    if (statusId === 6) {
      setStatusBadge('error', 'COMPILE ERROR');
      renderOutput(`✖ Compilation Error\n\n${compileOutput || 'Unknown compile error.'}`, 'error');
      saveHistory({ time: new Date().toISOString(), status: 'error', statusLabel: 'Compile Error', input: stdin, output: compileOutput });
      toast('Compilation failed', 'error');
      return;
    }

    if (statusId === 5) {
      setStatusBadge('error', 'TIME LIMIT');
      renderOutput(`⏱ Time Limit Exceeded\n\nYour program took too long to finish.`, 'warn');
      saveHistory({ time: new Date().toISOString(), status: 'error', statusLabel: 'Time Limit Exceeded', input: stdin, output: 'Time Limit Exceeded' });
      toast('Time limit exceeded', 'error');
      return;
    }

    if (statusId >= 7 && statusId <= 12) {
      // 7 SIGSEGV, 8 SIGXFSZ, 9 SIGFPE, 10 SIGABRT, 11 NZEC, 12 Other runtime error
      setStatusBadge('error', 'RUNTIME ERROR');
      renderOutput(`✖ Runtime Error (${statusDescription})\n\n${stderr || 'No error details returned.'}`, 'error');
      saveHistory({ time: new Date().toISOString(), status: 'error', statusLabel: 'Runtime Error', input: stdin, output: stderr || statusDescription });
      toast('Runtime error', 'error');
      return;
    }

    if (statusId === 13) {
      setStatusBadge('error', 'INTERNAL ERROR');
      renderOutput(`✖ Judge0 Internal Error\n\n${stderr || 'Please try again.'}`, 'error');
      saveHistory({ time: new Date().toISOString(), status: 'error', statusLabel: 'Internal Error', input: stdin, output: stderr });
      return;
    }

    if (statusId === 14) {
      setStatusBadge('error', 'EXEC FORMAT ERROR');
      renderOutput(`✖ Exec Format Error\n\n${stderr || ''}`, 'error');
      saveHistory({ time: new Date().toISOString(), status: 'error', statusLabel: 'Exec Format Error', input: stdin, output: stderr });
      return;
    }

    if (statusId === 3 || statusId === 4) {
      // 3 = Accepted (ran fine), 4 = "Wrong Answer" (only relevant with expected output, treat as success here)
      setStatusBadge('success');
      const out = (stdout && stdout.length) ? stdout : '(program produced no output)';
      renderOutput(`$ ./arafat\n${out}`);
      saveHistory({ time: new Date().toISOString(), status: 'ok', statusLabel: 'Success', input: stdin, output: stdout });
      toast('Run completed', 'success');
      return;
    }

    // fallback for any unmapped status id
    setStatusBadge('error', statusDescription || 'UNKNOWN');
    renderOutput(`${statusDescription || 'Unknown status'}\n\n${stdout || stderr || compileOutput || ''}`, 'warn');
    saveHistory({ time: new Date().toISOString(), status: 'error', statusLabel: statusDescription || 'Unknown', input: stdin, output: stdout || stderr || compileOutput });
  }

  /* =========================================================
     RUN HISTORY (localStorage)
     ========================================================= */
  function loadHistory() {
    try {
      const raw = localStorage.getItem(CONFIG.HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(entry) {
    const list = loadHistory();
    list.unshift(entry);
    while (list.length > CONFIG.HISTORY_LIMIT) list.pop();
    localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(list));
    renderHistory();
  }

  function renderHistory() {
    const list = loadHistory();
    el.historyList.innerHTML = '';

    if (list.length === 0) {
      el.historyList.innerHTML = '<li class="history-empty">No runs yet.</li>';
      return;
    }

    list.forEach((entry) => {
      const li = document.createElement('li');
      li.className = 'history-item';

      const timeLabel = document.createElement('span');
      timeLabel.className = 'history-time';
      timeLabel.textContent = new Date(entry.time).toLocaleTimeString();

      const statusLabel = document.createElement('span');
      statusLabel.className = `history-status ${entry.status === 'ok' ? 'ok' : 'bad'}`;
      statusLabel.textContent = entry.statusLabel || (entry.status === 'ok' ? 'Success' : 'Error');

      li.appendChild(timeLabel);
      li.appendChild(statusLabel);

      // clicking a history entry replays its input + output into the view
      li.addEventListener('click', () => {
        el.stdinBox.value = entry.input || '';
        renderOutput(entry.output || '(no output recorded)', entry.status === 'ok' ? 'normal' : 'error');
        setStatusBadge(entry.status === 'ok' ? 'success' : 'error', entry.statusLabel);
        toast('Loaded from history', 'info', 1800);
      });

      el.historyList.appendChild(li);
    });
  }

  function clearHistory() {
    localStorage.removeItem(CONFIG.HISTORY_KEY);
    renderHistory();
    toast('History cleared', 'info', 1800);
  }

  /* =========================================================
     EVENT BINDINGS
     ========================================================= */
  el.refreshBtn.addEventListener('click', () => fetchCode(true));
  el.copyBtn.addEventListener('click', copyCode);
  el.downloadBtn.addEventListener('click', downloadCode);
  el.runBtn.addEventListener('click', runCode);
  el.clearHistoryBtn.addEventListener('click', clearHistory);

  // Ctrl+Enter (or Cmd+Enter on Mac) runs the code from anywhere on the page
  document.addEventListener('keydown', (e) => {
    const isRunShortcut = (e.ctrlKey || e.metaKey) && e.key === 'Enter';
    if (isRunShortcut) {
      e.preventDefault();
      runCode();
    }
  });

  /* =========================================================
     INIT
     ========================================================= */
  window.addEventListener('DOMContentLoaded', () => {
    fetchCode(false);
    renderHistory();
    setStatusBadge('idle');
  });
})();
