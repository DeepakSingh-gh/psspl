// Preloaded only by the UAT runner. Never load client .env or baseline data.
import net from 'node:net';
import { syncBuiltinESMExports } from 'node:module';
const loopback = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const options = Array.isArray(args[0]) ? args[0][0] : args[0];
  const host = typeof options === 'object' ? options.host : typeof args[1] === 'string' ? args[1] : 'localhost';
  if (!loopback.has(host || 'localhost')) throw new Error('UAT blocked non-loopback network connection');
  return originalConnect.apply(this, args);
};
syncBuiltinESMExports();
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!loopback.has(url.hostname)) throw new Error('UAT blocked non-loopback provider request');
  return originalFetch(input, options);
};
