/**
 * api/run.js
 * -----------------------------------------------------------
 * Vercel Serverless Function.
 *
 * Flow:
 *   1. Fetch the latest raw arafat.c from GitHub (cache-busted).
 *   2. Submit it to Judge0 along with the user-provided stdin.
 *   3. Poll Judge0 until the submission finishes (or times out).
 *   4. Return a normalized JSON payload to the frontend.
 *
 * JUDGE0 — NO CARD, NO SIGN-UP, NO API KEY NEEDED
 * -----------------------------------------------------------
 * This uses the free public Judge0 CE demo instance at
 * https://ce.judge0.com — it does not require any API key,
 * RapidAPI account, or payment card. It is rate-limited
 * (fine for personal/demo use) but perfectly free.
 *
 * If you ever DO get a Judge0 key later (RapidAPI, Sulu, or a
 * self-hosted instance), you can switch to it without touching
 * this file's logic — just set these optional environment
 * variables in Vercel and the code below will pick them up
 * automatically:
 *   JUDGE0_API_URL   e.g. https://judge0-ce.p.rapidapi.com
 *   JUDGE0_API_KEY   your key (only needed for RapidAPI-style hosts)
 *   JUDGE0_API_HOST  e.g. judge0-ce.p.rapidapi.com
 * If these are not set, it automatically falls back to the free
 * public instance below — zero configuration required.
 * -----------------------------------------------------------
 */

const GITHUB_USER = 'nahidcore';
const GITHUB_REPO = 'myc';
const GITHUB_BRANCH = 'main'; // change to "master" if that is your default branch
const FILE_NAME = 'arafat.c';

// Free, keyless public Judge0 CE instance (fallback default).
const FREE_JUDGE0_URL = 'https://ce.judge0.com';

// Judge0 language id for "C (GCC 9.2.0)". Check /languages on your
// Judge0 instance if you need a different compiler version.
const C_LANGUAGE_ID = 50;

// Kept short on purpose: Vercel Hobby plan serverless functions have a
// 10 second execution limit, so total polling time must stay well under that.
const POLL_INTERVAL_MS = 800;
const MAX_POLL_ATTEMPTS = 8; // ~6.4 seconds max wait

/* ---------------- Judge0 endpoint resolution ---------------- */

// Use a custom Judge0 host only if BOTH url and key are provided.
// Otherwise fall back to the free public instance with no auth headers.
const JUDGE0_BASE_URL = process.env.JUDGE0_API_URL || FREE_JUDGE0_URL;
const USE_RAPIDAPI_AUTH = Boolean(process.env.JUDGE0_API_KEY && process.env.JUDGE0_API_HOST);

function judge0Headers(extra = {}) {
  const headers = { ...extra };
  if (USE_RAPIDAPI_AUTH) {
    headers['X-RapidAPI-Key'] = process.env.JUDGE0_API_KEY;
    headers['X-RapidAPI-Host'] = process.env.JUDGE0_API_HOST;
  }
  return headers;
}

/* ---------------- helpers ---------------- */

function githubRawUrl() {
  return `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${FILE_NAME}?t=${Date.now()}`;
}

function toBase64(str) {
  return Buffer.from(str ?? '', 'utf-8').toString('base64');
}

function fromBase64(str) {
  if (str === null || str === undefined) return '';
  return Buffer.from(str, 'base64').toString('utf-8');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches arafat.c straight from GitHub so the judge always
 * runs whatever is currently committed to the repository.
 */
async function fetchLatestSource() {
  const res = await fetch(githubRawUrl(), {
    headers: { 'Cache-Control': 'no-cache' }
  });
  if (!res.ok) {
    throw new Error(`GitHub fetch failed with HTTP ${res.status}`);
  }
  return res.text();
}

/**
 * Creates a Judge0 submission and returns its token.
 */
async function createSubmission(sourceCode, stdin) {
  const url = `${JUDGE0_BASE_URL}/submissions?base64_encoded=true&wait=false`;

  const res = await fetch(url, {
    method: 'POST',
    headers: judge0Headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      language_id: C_LANGUAGE_ID,
      source_code: toBase64(sourceCode),
      stdin: toBase64(stdin)
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Judge0 submission failed (HTTP ${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.token) {
    throw new Error('Judge0 did not return a submission token.');
  }
  return data.token;
}

/**
 * Polls Judge0 until the submission is finished (status.id > 2)
 * or the max attempts are reached.
 */
async function pollSubmission(token) {
  const url = `${JUDGE0_BASE_URL}/submissions/${token}?base64_encoded=true`;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const res = await fetch(url, { headers: judge0Headers() });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Judge0 polling failed (HTTP ${res.status}): ${text}`);
    }

    const data = await res.json();

    // status.id: 1 = In Queue, 2 = Processing, 3+ = finished (success or a specific error)
    if (data.status && data.status.id > 2) {
      return data;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error('Judge0 did not finish processing in time. Please try again.');
}

/* ---------------- handler ---------------- */

module.exports = async (req, res) => {
  // Only POST is allowed
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const stdin = (req.body && typeof req.body.input === 'string') ? req.body.input : '';

    // 1. Always run the freshest committed version of arafat.c
    const sourceCode = await fetchLatestSource();

    // 2. Submit to Judge0 (free public instance, or your own if configured)
    const token = await createSubmission(sourceCode, stdin);

    // 3. Poll until finished
    const result = await pollSubmission(token);

    // 4. Normalize and return
    res.status(200).json({
      statusId: result.status.id,
      statusDescription: result.status.description,
      stdout: fromBase64(result.stdout),
      stderr: fromBase64(result.stderr),
      compileOutput: fromBase64(result.compile_output),
      message: fromBase64(result.message),
      time: result.time,
      memory: result.memory
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
};
