import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Case } from '../src/models/Case.js';
import { Evidence } from '../src/models/Evidence.js';
import { generateTokens } from '../src/middleware/auth.js';

describe('BlackBox Zero-Trust Security & Injection Hardening Suite', () => {
  let invA, invB;
  let tokenA, tokenB;
  let caseA, caseB;

  beforeAll(async () => {
    await setupTestDB();
    process.env.GOOGLE_CLIENT_ID = 'test_google_client_id_placeholder';
    process.env.GOOGLE_CLIENT_SECRET = 'test_google_client_secret_placeholder';
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    process.env.GOOGLE_CLIENT_ID = 'test_google_client_id_placeholder';
    process.env.GOOGLE_CLIENT_SECRET = 'test_google_client_secret_placeholder';

    invA = await User.create({
      name: 'Agent Alpha',
      email: 'alpha@blackbox.local',
      passwordHash: 'hash123',
      role: 'investigator',
      status: 'active'
    });

    invB = await User.create({
      name: 'Agent Beta',
      email: 'beta@blackbox.local',
      passwordHash: 'hash123',
      role: 'investigator',
      status: 'active'
    });

    tokenA = generateTokens(invA).accessToken;
    tokenB = generateTokens(invB).accessToken;

    caseA = await Case.create({
      title: 'Classified Operation Alpha',
      description: 'Alpha secret case files',
      status: 'active',
      createdBy: invA._id,
      assignedInvestigators: [invA._id]
    });

    caseB = await Case.create({
      title: 'Classified Operation Beta',
      description: 'Beta secret case files',
      status: 'active',
      createdBy: invB._id,
      assignedInvestigators: [invB._id]
    });

    await Evidence.create({
      caseId: caseA._id,
      title: 'Alpha Secret Evidence Artifact',
      description: 'Confidential alpha evidence',
      type: 'digital_log',
      source: 'Internal Server',
      collectedBy: invA._id,
      verificationStatus: 'verified'
    });

    await Evidence.create({
      caseId: caseB._id,
      title: 'Beta Secret Evidence Artifact',
      description: 'Confidential beta evidence',
      type: 'digital_log',
      source: 'Internal Server',
      collectedBy: invB._id,
      verificationStatus: 'verified'
    });
  });

  // 1. NoSQL Injection Defense
  it('NoSQL Injection: Should sanitize or strip $ne, $gt, and $where operator payloads in login', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: { $ne: null },
      password: { $gt: '' }
    });

    expect([400, 401]).toContain(res.status);
    expect(res.body).toHaveProperty('error');
  });

  it('NoSQL Injection: Should sanitize operator injection payloads in queries', async () => {
    const res = await request(app)
      .get('/api/v1/cases')
      .query({ search: { $gt: '' } })
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // 2. Search Authorization Isolation
  it('Search Security: Investigator A searching for "Secret" must NOT see Investigator B private evidence or cases', async () => {
    const res = await request(app)
      .get('/api/v1/search?q=Secret')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const caseTitles = res.body.data.cases.map((c) => c.title);
    const evidenceTitles = res.body.data.evidence.map((e) => e.title);

    expect(caseTitles).toContain('Classified Operation Alpha');
    expect(caseTitles).not.toContain('Classified Operation Beta');

    expect(evidenceTitles).toContain('Alpha Secret Evidence Artifact');
    expect(evidenceTitles).not.toContain('Beta Secret Evidence Artifact');
  });

  // 3. AI Case Isolation
  it('AI Data Isolation: Investigator A CANNOT query AI chatbot on Investigator B case file (403)', async () => {
    const res = await request(app)
      .post(`/api/v1/cases/${caseB._id}/ai/chat`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ message: 'What evidence exists in this case?' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // 4. Insecure Google Endpoint Removal Check
  it('Google OAuth: Legacy insecure /api/v1/auth/google/verify endpoint is removed and inaccessible (404)', async () => {
    const res = await request(app).post('/api/v1/auth/google/verify').send({
      email: 'attacker@blackbox.local',
      name: 'Attacker',
      role: 'admin'
    });

    expect(res.status).toBe(404);
  });

  // 5. Data Leak Prevention
  it('Data Leak Prevention: User profile responses must NEVER leak passwordHash, mfaSecret, or JWT secrets', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(res.body.data.user).not.toHaveProperty('mfaSecret');
  });
});
