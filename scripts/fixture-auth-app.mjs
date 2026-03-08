#!/usr/bin/env node
import http from 'node:http';
import { URL } from 'node:url';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function html(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function parseCookies(cookieHeader = '') {
  const out = {};
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (!key) continue;
    out[key] = rest.join('=');
  }
  return out;
}

const args = parseArgs(process.argv);
const requestedPort = Number(args.port || 3177);
const loginPath = args.loginPath || '/login';
const postLoginPath = args.postLoginPath || '/courses';
const protectedPath = args.protectedPath || '/dashboard';
const bootstrapPath = args.bootstrapPath || '/api/bootstrap-user';
let seededUser = {
  email: args.email || 'reviewer@local.test',
  password: args.password || 'secret123',
  name: args.name || 'Fixture User',
};

const server = http.createServer(async (req, res) => {
  const activePort = server.address()?.port || requestedPort;
  const reqUrl = new URL(req.url || '/', `http://127.0.0.1:${activePort}`);
  const cookies = parseCookies(req.headers.cookie || '');
  const isAuthed = cookies.auth === '1';

  if (req.method === 'POST' && reqUrl.pathname === bootstrapPath) {
    try {
      const raw = await readBody(req);
      const payload = raw ? JSON.parse(raw) : {};
      const user = payload.user || payload;
      if (user.email) seededUser.email = user.email;
      if (user.password) seededUser.password = user.password;
      if (user.name) seededUser.name = user.name;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, seededUser }));
      return;
    } catch (error) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: String(error) }));
      return;
    }
  }

  if (req.method === 'GET' && reqUrl.pathname === loginPath) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html('Login', `
      <h1>Fixture Login</h1>
      <form method="POST" action="${loginPath}">
        <label>Email <input type="email" name="email" /></label>
        <label>Password <input type="password" name="password" /></label>
        <button type="submit">Sign in</button>
      </form>
    `));
    return;
  }

  if (req.method === 'POST' && reqUrl.pathname === loginPath) {
    const raw = await readBody(req);
    const params = new URLSearchParams(raw);
    const email = params.get('email') || '';
    const password = params.get('password') || '';
    if (email === seededUser.email && password === seededUser.password) {
      res.writeHead(302, {
        location: postLoginPath,
        'set-cookie': 'auth=1; Path=/',
      });
      res.end('ok');
      return;
    }
    res.writeHead(401, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html('Unauthorized', '<p>Unauthorized</p>'));
    return;
  }

  if (req.method === 'GET' && reqUrl.pathname === postLoginPath) {
    if (!isAuthed) {
      res.writeHead(302, { location: loginPath });
      res.end('redirect');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html('Courses', `<main><h1>Courses</h1><a href="${protectedPath}">Open protected route</a></main>`));
    return;
  }

  if (req.method === 'GET' && reqUrl.pathname === protectedPath) {
    if (!isAuthed) {
      res.writeHead(302, { location: loginPath });
      res.end('redirect');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html('Protected', `
      <main>
        <h1>Protected dashboard</h1>
        <p id="welcome">Welcome ${seededUser.name}</p>
        <button type="button">Review queue</button>
      </main>
    `));
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('not found');
});

server.listen(requestedPort, '127.0.0.1', () => {
  const activePort = server.address()?.port || requestedPort;
  console.log(JSON.stringify({ ok: true, port: activePort, loginPath, postLoginPath, protectedPath, bootstrapPath }));
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
