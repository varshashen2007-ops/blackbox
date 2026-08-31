import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { config } from '../src/config/env.js';
import { pendingOAuthStates } from '../src/routes/googleAuth.routes.js';

describe('Phase 20 — Comprehensive Google OAuth 2.0 / OIDC Test Suite', () => {
  const originalFetch = global.fetch;

  beforeAll(async () => {
    config.google.clientId = 'test_google_client_id_123';
    config.google.clientSecret = 'test_google_client_secret_secret456';
    config.google.redirectUri = 'http://localhost:5000/api/v1/auth/google/callback';
    config.google.frontendUrl = 'http://localhost:5173';
    await setupTestDB();
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    pendingOAuthStates.clear();
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // 1. OAuth start endpoint
  it('1. GET /api/v1/auth/google generates secure state and redirects to Google OAuth consent screen', async () => {
    const res = await request(app).get('/api/v1/auth/google');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(res.headers.location).toContain(`client_id=${config.google.clientId}`);
    expect(res.headers.location).toContain(`redirect_uri=${encodeURIComponent(config.google.redirectUri)}`);
    expect(res.headers.location).toContain('response_type=code');
    expect(res.headers.location).toContain('scope=openid+email+profile');
    expect(res.headers.location).toContain('state=');
  });

  // 2. State generation
  it('2. State parameter is a cryptographically strong random token saved in server state store', async () => {
    const res = await request(app).get('/api/v1/auth/google');
    const redirectUrl = new URL(res.headers.location);
    const state = redirectUrl.searchParams.get('state');

    expect(state).toBeTruthy();
    expect(state.length).toBe(64); // 32 bytes hex
    expect(pendingOAuthStates.has(state)).toBe(true);
  });

  // 3. State mismatch
  it('3. State mismatch on callback rejects with oauth_state_invalid and logs OAUTH_STATE_MISMATCH', async () => {
    const res = await request(app)
      .get('/api/v1/auth/google/callback')
      .query({ code: 'auth_code_123', state: 'invalid_unrecognized_state' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=oauth_state_invalid');

    const audit = await AuditLog.findOne({ action: 'OAUTH_STATE_MISMATCH' });
    expect(audit).not.toBeNull();
  });

  // 4. Missing state
  it('4. Missing state parameter on callback rejects with oauth_state_missing and logs audit event', async () => {
    const res = await request(app)
      .get('/api/v1/auth/google/callback')
      .query({ code: 'auth_code_123' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=oauth_state_missing');

    const audit = await AuditLog.findOne({ action: 'OAUTH_STATE_MISMATCH' });
    expect(audit).not.toBeNull();
  });

  // 5. Missing authorization code
  it('5. Missing authorization code on callback redirects with oauth_code_missing', async () => {
    const validState = 'valid_state_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    pendingOAuthStates.set(validState, { createdAt: Date.now() });

    const res = await request(app)
      .get('/api/v1/auth/google/callback')
      .query({ state: validState });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=oauth_code_missing');
  });

  // 6. OAuth denial
  it('6. OAuth consent denial (error=access_denied) redirects safely and logs OAUTH_DENIED', async () => {
    const res = await request(app)
      .get('/api/v1/auth/google/callback')
      .query({ error: 'access_denied' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=oauth_denied');

    const audit = await AuditLog.findOne({ action: 'OAUTH_DENIED' });
    expect(audit).not.toBeNull();
  });

  // 7. Token exchange failure
  it('7. Token exchange failure logs OAUTH_TOKEN_EXCHANGE_FAILED and redirects with error', async () => {
    const validState = 'valid_state_token_fail_1234567890abcdef1234567890abcdef1234567890abcd';
    pendingOAuthStates.set(validState, { createdAt: Date.now() });

    global.fetch = vi.fn().mockImplementation((url) => {
      const urlStr = url.toString();
      if (urlStr.includes('tokeninfo')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      if (urlStr.endsWith('/token') || urlStr.includes('/token?')) {
        return Promise.resolve({
          ok: false,
          status: 400,
          text: () => Promise.resolve('{"error":"invalid_grant"}')
        });
      }
      return Promise.reject(new Error(`Unknown URL: ${urlStr}`));
    });

    const res = await request(app)
      .get('/api/v1/auth/google/callback')
      .query({ code: 'bad_code', state: validState });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=oauth_exchange_failed');

    const audit = await AuditLog.findOne({ action: 'OAUTH_TOKEN_EXCHANGE_FAILED' });
    expect(audit).not.toBeNull();
  });

  // 8. Invalid Google identity
  it('8. Invalid Google ID token verification failure logs OAUTH_INVALID_TOKEN and rejects', async () => {
    const validState = 'valid_state_token_invalid_1234567890abcdef1234567890abcdef1234567890';
    pendingOAuthStates.set(validState, { createdAt: Date.now() });

    global.fetch = vi.fn().mockImplementation((url) => {
      const urlStr = url.toString();
      if (urlStr.includes('tokeninfo')) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: 'invalid_token' })
        });
      }
      if (urlStr.endsWith('/token') || urlStr.includes('/token?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id_token: 'fake_jwt_token' })
        });
      }
      return Promise.reject(new Error(`Unknown URL: ${urlStr}`));
    });

    const res = await request(app)
      .get('/api/v1/auth/google/callback')
      .query({ code: 'some_code', state: validState });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=oauth_invalid_token');

    const audit = await AuditLog.findOne({ action: 'OAUTH_INVALID_TOKEN' });
    expect(audit).not.toBeNull();
  });

  // 9. Expired Google identity
  it('9. Expired Google ID token claims reject with oauth_token_expired', async () => {
    const validState = 'valid_state_expired_1234567890abcdef1234567890abcdef1234567890abcdef';
    pendingOAuthStates.set(validState, { createdAt: Date.now() });

    const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

    global.fetch = vi.fn().mockImplementation((url) => {
      const urlStr = url.toString();
      if (urlStr.includes('tokeninfo')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            iss: 'https://accounts.google.com',
            aud: config.google.clientId,
            sub: 'google_sub_expired',
            email: 'expired@google.com',
            email_verified: 'true',
            exp: pastExp
          })
        });
      }
      if (urlStr.endsWith('/token') || urlStr.includes('/token?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id_token: 'expired_jwt_token' })
        });
      }
      return Promise.reject(new Error(`Unknown URL: ${urlStr}`));
    });

    const res = await request(app)
      .get('/api/v1/auth/google/callback')
      .query({ code: 'some_code', state: validState });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=oauth_token_expired');
  });

  // 10. Invalid audience
  it('10. Token audience mismatch logs OAUTH_AUDIENCE_MISMATCH and rejects', async () => {
    const validState = 'valid_state_aud_mismatch_1234567890abcdef1234567890abcdef1234567890ab';
    pendingOAuthStates.set(validState, { createdAt: Date.now() });

    global.fetch = vi.fn().mockImplementation((url) => {
      const urlStr = url.toString();
      if (urlStr.includes('tokeninfo')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            iss: 'https://accounts.google.com',
            aud: 'foreign_client_id_attacker',
            sub: 'google_sub_aud',
            email: 'aud_user@google.com',
            email_verified: 'true',
            exp: Math.floor(Date.now() / 1000) + 3600
          })
        });
      }
      if (urlStr.endsWith('/token') || urlStr.includes('/token?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id_token: 'aud_mismatch_jwt' })
        });
      }
      return Promise.reject(new Error(`Unknown URL: ${urlStr}`));
    });

    const res = await request(app)
      .get('/api/v1/auth/google/callback')
      .query({ code: 'some_code', state: validState });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=oauth_audience_mismatch');

    const audit = await AuditLog.findOne({ action: 'OAUTH_AUDIENCE_MISMATCH' });
    expect(audit).not.toBeNull();
  });

  // 11. Invalid issuer
  it('11. Token with illegitimate issuer logs OAUTH_INVALID_ISSUER and rejects', async () => {
    const validState = 'valid_state_iss_mismatch_1234567890abcdef1234567890abcdef1234567890ab';
    pendingOAuthStates.set(validState, { createdAt: Date.now() });

    global.fetch = vi.fn().mockImplementation((url) => {
      const urlStr = url.toString();
      if (urlStr.includes('tokeninfo')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            iss: 'https://evil-issuer.example.com',
            aud: config.google.clientId,
            sub: 'google_sub_iss',
            email: 'iss_user@google.com',
            email_verified: 'true',
            exp: Math.floor(Date.now() / 1000) + 3600
          })
        });
      }
      if (urlStr.endsWith('/token') || urlStr.includes('/token?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id_token: 'fake_iss_jwt' })
        });
      }
      return Promise.reject(new Error(`Unknown URL: ${urlStr}`));
    });

    const res = await request(app)
      .get('/api/v1/auth/google/callback')
      .query({ code: 'some_code', state: validState });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=oauth_invalid_issuer');

    const audit = await AuditLog.findOne({ action: 'OAUTH_INVALID_ISSUER' });
    expect(audit).not.toBeNull();
  });

  // 12. New Google user becomes investigator (Level 1)
  it('12. Successful OAuth flow creates new User with strictly investigator role (Level 1)', async () => {
    const validState = 'valid_state_new_user_1234567890abcdef1234567890abcdef1234567890abcdef';
    pendingOAuthStates.set(validState, { createdAt: Date.now() });

    global.fetch = vi.fn().mockImplementation((url) => {
      const urlStr = url.toString();
      if (urlStr.includes('tokeninfo')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            iss: 'https://accounts.google.com',
            aud: config.google.clientId,
            sub: 'google_sub_10928374',
            email: 'dr.watson@google.com',
            name: 'Dr. John Watson',
            email_verified: 'true',
            exp: Math.floor(Date.now() / 1000) + 3600
          })
        });
      }
      if (urlStr.endsWith('/token') || urlStr.includes('/token?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id_token: 'valid_new_user_token' })
        });
      }
      return Promise.reject(new Error(`Unknown URL: ${urlStr}`));
    });

    const res = await request(app)
      .get('/api/v1/auth/google/callback')
      .query({ code: 'valid_auth_code_123', state: validState });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('oauth_success=true');
    expect(res.headers.location).toContain('accessToken=');

    const createdUser = await User.findOne({ email: 'dr.watson@google.com' });
    expect(createdUser).not.toBeNull();
    expect(createdUser.role).toBe('investigator');
    expect(createdUser.securityLevel).toBe(1);
    expect(createdUser.identityVerified).toBe(true);
    expect(createdUser.emailVerified).toBe(true);
    expect(createdUser.googleSubjectId).toBe('google_sub_10928374');
  });

  // 13 & 14. Google user cannot become admin or supervisor through OAuth
  it('13 & 14. Google OAuth cannot provision admin or supervisor roles for newly registered users', async () => {
    const validState = 'valid_state_role_check_1234567890abcdef1234567890abcdef1234567890abcd';
    pendingOAuthStates.set(validState, { createdAt: Date.now() });

    global.fetch = vi.fn().mockImplementation((url) => {
      const urlStr = url.toString();
      if (urlStr.includes('tokeninfo')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            iss: 'https://accounts.google.com',
            aud: config.google.clientId,
            sub: 'google_sub_role_check',
            email: 'investigator_test@google.com',
            name: 'Test Investigator',
            role: 'admin', // Injected by rogue claim
            supervisorStatus: 'approved',
            email_verified: 'true',
            exp: Math.floor(Date.now() / 1000) + 3600
          })
        });
      }
      if (urlStr.endsWith('/token') || urlStr.includes('/token?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id_token: 'valid_role_check_token' })
        });
      }
      return Promise.reject(new Error(`Unknown URL: ${urlStr}`));
    });

    await request(app)
      .get('/api/v1/auth/google/callback')
      .query({ code: 'role_test_code', state: validState });

    const user = await User.findOne({ email: 'investigator_test@google.com' });
    expect(user).not.toBeNull();
    expect(user.role).toBe('investigator');
    expect(user.securityLevel).toBe(1);
    expect(user.supervisorStatus).toBe('none');
  });

  // 15. Existing user linking
  it('15. Existing BlackBox user logs in via Google and links account by matching email without altering role', async () => {
    // Pre-existing supervisor account
    const existingSupervisor = await User.create({
      name: 'Existing Supervisor',
      email: 'supervisor_pre_existing@blackbox.local',
      passwordHash: 'hash_pre_existing',
      role: 'supervisor',
      supervisorStatus: 'approved',
      status: 'active',
      identityVerified: false
    });

    const validState = 'valid_state_linking_1234567890abcdef1234567890abcdef1234567890abcdef';
    pendingOAuthStates.set(validState, { createdAt: Date.now() });

    global.fetch = vi.fn().mockImplementation((url) => {
      const urlStr = url.toString();
      if (urlStr.includes('tokeninfo')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            iss: 'https://accounts.google.com',
            aud: config.google.clientId,
            sub: 'google_sub_linked_9988',
            email: 'supervisor_pre_existing@blackbox.local',
            email_verified: 'true',
            exp: Math.floor(Date.now() / 1000) + 3600
          })
        });
      }
      if (urlStr.endsWith('/token') || urlStr.includes('/token?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id_token: 'linking_token' })
        });
      }
      return Promise.reject(new Error(`Unknown URL: ${urlStr}`));
    });

    const res = await request(app)
      .get('/api/v1/auth/google/callback')
      .query({ code: 'link_code_123', state: validState });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('oauth_success=true');

    const updatedUser = await User.findById(existingSupervisor._id);
    expect(updatedUser.googleSubjectId).toBe('google_sub_linked_9988');
    expect(updatedUser.identityVerified).toBe(true);
    expect(updatedUser.role).toBe('supervisor'); // Retains existing privileged role
  });

  // 16. Client secret never appears in API response
  it('16. Google client secret is never included in any API response or redirect parameter', async () => {
    const startRes = await request(app).get('/api/v1/auth/google');
    expect(startRes.headers.location).not.toContain(config.google.clientSecret);

    const validState = 'valid_state_secret_check_1234567890abcdef1234567890abcdef1234567890';
    pendingOAuthStates.set(validState, { createdAt: Date.now() });

    global.fetch = vi.fn().mockImplementation((url) => {
      const urlStr = url.toString();
      if (urlStr.includes('tokeninfo')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            iss: 'https://accounts.google.com',
            aud: config.google.clientId,
            sub: 'google_sub_secret_check',
            email: 'secret_check@google.com',
            email_verified: 'true',
            exp: Math.floor(Date.now() / 1000) + 3600
          })
        });
      }
      if (urlStr.endsWith('/token') || urlStr.includes('/token?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id_token: 'secret_check_token' })
        });
      }
      return Promise.reject(new Error(`Unknown URL: ${urlStr}`));
    });

    const cbRes = await request(app)
      .get('/api/v1/auth/google/callback')
      .query({ code: 'secret_code', state: validState });

    expect(cbRes.headers.location).not.toContain(config.google.clientSecret);
  });

  // 17. Google tokens never appear in API response
  it('17. Raw Google tokens (id_token) are never leaked to frontend URL', async () => {
    const validState = 'valid_state_token_leak_1234567890abcdef1234567890abcdef1234567890ab';
    pendingOAuthStates.set(validState, { createdAt: Date.now() });

    const rawGoogleToken = 'google_raw_id_token_xyz_do_not_leak';

    global.fetch = vi.fn().mockImplementation((url) => {
      const urlStr = url.toString();
      if (urlStr.includes('tokeninfo')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            iss: 'https://accounts.google.com',
            aud: config.google.clientId,
            sub: 'google_sub_leak_check',
            email: 'leak_check@google.com',
            email_verified: 'true',
            exp: Math.floor(Date.now() / 1000) + 3600
          })
        });
      }
      if (urlStr.endsWith('/token') || urlStr.includes('/token?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id_token: rawGoogleToken })
        });
      }
      return Promise.reject(new Error(`Unknown URL: ${urlStr}`));
    });

    const res = await request(app)
      .get('/api/v1/auth/google/callback')
      .query({ code: 'leak_code', state: validState });

    expect(res.headers.location).not.toContain(rawGoogleToken);
  });

  // 18. Frontend cannot forge Google identity (legacy insecure /verify removed)
  it('18. Insecure /verify endpoint is completely removed (404)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/google/verify')
      .send({
        email: 'attacker@evil.com',
        name: 'Attacker',
        googleSubjectId: 'forged_sub',
        role: 'admin'
      });

    expect(res.status).toBe(404);
  });

  // 19. Successful OAuth callback creates BlackBox session
  it('19. Successful OAuth creates valid BlackBox access token usable for authenticated endpoints', async () => {
    const validState = 'valid_state_session_1234567890abcdef1234567890abcdef1234567890abcdef';
    pendingOAuthStates.set(validState, { createdAt: Date.now() });

    global.fetch = vi.fn().mockImplementation((url) => {
      const urlStr = url.toString();
      if (urlStr.includes('tokeninfo')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            iss: 'https://accounts.google.com',
            aud: config.google.clientId,
            sub: 'google_sub_session_user',
            email: 'session_user@google.com',
            name: 'Session User',
            email_verified: 'true',
            exp: Math.floor(Date.now() / 1000) + 3600
          })
        });
      }
      if (urlStr.endsWith('/token') || urlStr.includes('/token?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id_token: 'session_token' })
        });
      }
      return Promise.reject(new Error(`Unknown URL: ${urlStr}`));
    });

    const res = await request(app)
      .get('/api/v1/auth/google/callback')
      .query({ code: 'session_code', state: validState });

    const redirectUrl = new URL(res.headers.location);
    const accessToken = redirectUrl.searchParams.get('accessToken');
    expect(accessToken).toBeTruthy();

    // Verify the returned token works on /api/v1/auth/me
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe('session_user@google.com');
    expect(meRes.body.data.user.role).toBe('investigator');
    expect(meRes.body.data.user.identityVerified).toBe(true);
  });
});
