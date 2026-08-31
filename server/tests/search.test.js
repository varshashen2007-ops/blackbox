import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Case } from '../src/models/Case.js';
import { Evidence } from '../src/models/Evidence.js';
import { Hypothesis } from '../src/models/Hypothesis.js';
import { generateTokens } from '../src/middleware/auth.js';

describe('Global Search & Notification Feed Suite', () => {
  let investigator, token, testCase;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    investigator = await User.create({
      name: 'Agent Doggett',
      email: 'doggett@blackbox.local',
      passwordHash: 'hash',
      role: 'investigator',
      status: 'active'
    });

    token = generateTokens(investigator).accessToken;

    testCase = await Case.create({
      title: 'Operation Blue Book',
      description: 'Anomalous network communications observed at perimeter radar station',
      status: 'active',
      createdBy: investigator._id,
      assignedInvestigators: [investigator._id]
    });

    await Evidence.create({
      caseId: testCase._id,
      title: 'Satellite Transmission PCAP',
      description: 'Encrypted frequency sweep',
      type: 'digital_log',
      source: 'Radar Station 4',
      collectedBy: investigator._id,
      tags: ['satellite', 'frequency']
    });

    await Hypothesis.create({
      caseId: testCase._id,
      title: 'External Airborne Transponder',
      description: 'Signals emitted from unmanned vehicle',
      createdBy: investigator._id
    });
  });

  it('GET /api/v1/search should find matching cases, evidence, and hypotheses', async () => {
    const res = await request(app)
      .get('/api/v1/search?q=satellite')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.evidence).toHaveLength(1);
    expect(res.body.data.evidence[0].title).toBe('Satellite Transmission PCAP');
  });

  it('GET /api/v1/notifications should return formatted notification feed', async () => {
    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
