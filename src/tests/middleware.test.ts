import { describe, it, expect } from 'vitest';
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { resolveIp } from '../libs/middleware.js';

function makeRequest(headers: Record<string, string> = {}, remoteAddress = '127.0.0.1'): IncomingMessage {
  const socket = new Socket();
  Object.defineProperty(socket, 'remoteAddress', { value: remoteAddress, writable: true });
  const req = new IncomingMessage(socket);
  Object.assign(req.headers, headers);
  return req;
}

describe('resolveIp', () => {
  it('prefers X-Real-IP over X-Forwarded-For', () => {
    const req = makeRequest({
      'x-real-ip': '198.51.100.7',
      'x-forwarded-for': '203.0.113.5, 10.0.0.1',
    });
    expect(resolveIp(req)).toBe('198.51.100.7');
  });

  it('uses X-Forwarded-For first client IP', () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' });
    expect(resolveIp(req)).toBe('203.0.113.5');
  });

  it('falls back to X-Real-IP', () => {
    const req = makeRequest({ 'x-real-ip': '198.51.100.7' });
    expect(resolveIp(req)).toBe('198.51.100.7');
  });

  it('falls back to socket remoteAddress', () => {
    const req = makeRequest({}, '192.168.1.100');
    expect(resolveIp(req)).toBe('192.168.1.100');
  });
});
