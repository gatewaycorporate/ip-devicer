import { describe, it, expect, vi } from 'vitest';
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import type { ServerResponse } from 'node:http';
import { createIpMiddleware, resolveIp } from '../libs/middleware.js';

function makeRequest(headers: Record<string, string> = {}, remoteAddress = '127.0.0.1'): IncomingMessage {
  const socket = new Socket();
  Object.defineProperty(socket, 'remoteAddress', { value: remoteAddress, writable: true });
  const req = new IncomingMessage(socket);
  Object.assign(req.headers, headers);
  return req;
}

describe('resolveIp', () => {
  it('uses the first value when CF-Connecting-IP is an array', () => {
    const req = makeRequest({});
    req.headers['cf-connecting-ip'] = ['198.51.100.10', '198.51.100.11'];
    expect(resolveIp(req)).toBe('198.51.100.10');
  });

  it('prefers CF-Connecting-IP over X-Real-IP', () => {
    const req = makeRequest({
      'cf-connecting-ip': '198.51.100.10',
      'x-real-ip': '198.51.100.7',
    });
    expect(resolveIp(req)).toBe('198.51.100.10');
  });

  it('prefers True-Client-IP over X-Real-IP', () => {
    const req = makeRequest({
      'true-client-ip': '198.51.100.11',
      'x-real-ip': '198.51.100.7',
    });
    expect(resolveIp(req)).toBe('198.51.100.11');
  });

  it('uses the first value when True-Client-IP is an array', () => {
    const req = makeRequest({});
    req.headers['true-client-ip'] = ['198.51.100.11', '198.51.100.12'];
    expect(resolveIp(req)).toBe('198.51.100.11');
  });

  it('prefers X-Real-IP over X-Forwarded-For', () => {
    const req = makeRequest({
      'x-real-ip': '198.51.100.7',
      'x-forwarded-for': '203.0.113.5, 10.0.0.1',
    });
    expect(resolveIp(req)).toBe('198.51.100.7');
  });

  it('uses the first value when X-Real-IP is an array', () => {
    const req = makeRequest({});
    req.headers['x-real-ip'] = ['198.51.100.7', '198.51.100.8'];
    expect(resolveIp(req)).toBe('198.51.100.7');
  });

  it('uses X-Forwarded-For first client IP', () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' });
    expect(resolveIp(req)).toBe('203.0.113.5');
  });

  it('uses the first entry from an array X-Forwarded-For header', () => {
    const req = makeRequest({});
    req.headers['x-forwarded-for'] = ['203.0.113.5, 10.0.0.1', '198.51.100.4'];
    expect(resolveIp(req)).toBe('203.0.113.5');
  });

  it('falls back to socket remoteAddress when X-Forwarded-For is blank', () => {
    const req = makeRequest({ 'x-forwarded-for': '   ,   ' }, '192.168.1.101');
    expect(resolveIp(req)).toBe('192.168.1.101');
  });

  it('falls back to X-Real-IP', () => {
    const req = makeRequest({ 'x-real-ip': '198.51.100.7' });
    expect(resolveIp(req)).toBe('198.51.100.7');
  });

  it('falls back to socket remoteAddress', () => {
    const req = makeRequest({}, '192.168.1.100');
    expect(resolveIp(req)).toBe('192.168.1.100');
  });

  it('returns unknown when no header or remoteAddress is available', () => {
    const req = makeRequest();
    Object.defineProperty(req.socket, 'remoteAddress', { value: undefined, writable: true });
    expect(resolveIp(req)).toBe('unknown');
  });
});

describe('createIpMiddleware', () => {
  it('attaches resolvedIp and calls next', () => {
    const req = makeRequest({ 'x-real-ip': '198.51.100.7' }) as IncomingMessage & { resolvedIp?: string };
    const next = vi.fn();
    const middleware = createIpMiddleware();

    middleware(req, {} as ServerResponse, next);

    expect(req.resolvedIp).toBe('198.51.100.7');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
