import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OPENAPI_SPEC } from '../src/http/openapi.js';
import { Router } from '../src/http/router.js';
import { registerApiRoutes } from '../src/http/routes.js';

function collectRefs(node, refs = []) {
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, refs);
  } else if (node && typeof node === 'object') {
    if (typeof node.$ref === 'string') refs.push(node.$ref);
    for (const value of Object.values(node)) collectRefs(value, refs);
  }
  return refs;
}

describe('OpenAPI document', () => {
  const router = registerApiRoutes(new Router(), {
    eventService: {},
    bookingService: {},
  });

  it('documents only API routes that exist in the router', () => {
    for (const [openApiPath, methods] of Object.entries(OPENAPI_SPEC.paths)) {
      if (openApiPath === '/health') continue;
      const samplePath = openApiPath.replace(/\{[^}]+\}/g, 'sample-id');
      for (const method of Object.keys(methods)) {
        assert.ok(router.match(method.toUpperCase(), samplePath), `${method.toUpperCase()} ${openApiPath} not registered`);
      }
    }
  });

  it('documents every Build 4 API route', () => {
    const expectedRoutes = [
      ['get', '/health'],
      ['get', '/api/events'],
      ['post', '/api/events'],
      ['get', '/api/events/{id}'],
      ['post', '/api/events/{id}/tiers'],
      ['post', '/api/events/{id}/publish'],
      ['post', '/api/events/{id}/unpublish'],
      ['post', '/api/bookings'],
      ['get', '/api/bookings/{reference}'],
      ['post', '/api/bookings/{reference}/pay'],
      ['post', '/api/bookings/{reference}/cancel'],
    ];

    for (const [method, path] of expectedRoutes) {
      assert.ok(OPENAPI_SPEC.paths[path]?.[method], `Missing OpenAPI entry for ${method.toUpperCase()} ${path}`);
    }
  });

  it('points every $ref at a defined schema', () => {
    const schemas = OPENAPI_SPEC.components.schemas;
    for (const ref of collectRefs(OPENAPI_SPEC)) {
      const prefix = '#/components/schemas/';
      assert.ok(ref.startsWith(prefix), `Unexpected $ref format: ${ref}`);
      const name = ref.slice(prefix.length);
      assert.ok(Object.hasOwn(schemas, name), `Missing schema for $ref: ${ref}`);
    }
  });
});
