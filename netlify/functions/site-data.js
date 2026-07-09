const { getStore, connectLambda } = require('@netlify/blobs');

const KEY = 'site-data';
const STORE_NAME = 'matrix-mission-site';

function uid(){ return Math.random().toString(36).slice(2, 10); }

const DEFAULT_DATA = {
  passcode: '3141592',
  missionTitle: 'OPERATION NEBUCHADNEZZAR',
  missionStatus: 'STATUS: ACTIVE // CLEARANCE: LEVEL 3',
  mission:
    "Welcome, operative.\n\nThe machines have hardened their perimeter around Node 7. Your task is to locate the signal relay hidden inside the old subway grid and re-establish contact with Zion command.\n\nTrust no unencrypted channel. Trust no face you cannot verify twice.\n\nThe answer you're looking for is not in this file. It's in the next one.",
  images: [],
  owners: [
    { id: uid(), name: 'Morpheus', username: 'owner', password: 'owner123' }
  ],
  admins: []
};

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' };
  }

  try {
    // Required for classic (Lambda-style) Netlify Function handlers — without
    // this, Netlify Blobs has no site context and every call throws.
    connectLambda(event);

    const store = getStore(STORE_NAME);

    if (event.httpMethod === 'GET') {
      let data = await store.get(KEY, { type: 'json' });
      if (!data) {
        data = DEFAULT_DATA;
        await store.setJSON(KEY, data);
      }
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'POST') {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch (e) {
        return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
      }

      const { auth, data } = body;
      if (!auth || !auth.username || !auth.password) {
        return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Missing credentials.' }) };
      }
      if (!data || typeof data !== 'object') {
        return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Missing data payload.' }) };
      }

      let current = await store.get(KEY, { type: 'json' });
      if (!current) current = DEFAULT_DATA;

      const isValid = [...(current.owners || []), ...(current.admins || [])].some(
        (u) => u.username === auth.username && u.password === auth.password
      );
      if (!isValid) {
        return { statusCode: 403, headers: HEADERS, body: JSON.stringify({ error: 'Invalid username or password.' }) };
      }

      // Basic shape safety net so a malformed payload can't corrupt the store.
      const safeData = {
        passcode: typeof data.passcode === 'string' ? data.passcode : current.passcode,
        missionTitle: typeof data.missionTitle === 'string' ? data.missionTitle : current.missionTitle,
        missionStatus: typeof data.missionStatus === 'string' ? data.missionStatus : current.missionStatus,
        mission: typeof data.mission === 'string' ? data.mission : current.mission,
        images: Array.isArray(data.images) ? data.images : current.images,
        owners: Array.isArray(data.owners) && data.owners.length > 0 ? data.owners : current.owners,
        admins: Array.isArray(data.admins) ? data.admins : current.admins
      };

      await store.setJSON(KEY, safeData);
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed.' }) };
  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: 'Server error: ' + (err && err.message ? err.message : String(err)) })
    };
  }
};
