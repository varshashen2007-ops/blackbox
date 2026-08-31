import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Case } from '../src/models/Case.js';
import { Evidence } from '../src/models/Evidence.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { generateTokens } from '../src/middleware/auth.js';

describe('Evidence & Verification Suite (Track B)', () => {
  let investigator, supervisor;
  let invToken, supToken;
  let testCase;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    investigator = await User.create({
      name: 'Investigator Mulder',
      email: 'mulder@blackbox.local',
      passwordHash: 'hash123',
      role: 'investigator',
      status: 'active'
    });

    supervisor = await User.create({
      name: 'Supervisor Skinner',
      email: 'skinner@blackbox.local',
      passwordHash: 'hash123',
      role: 'supervisor',
      status: 'active'
    });

    invToken = generateTokens(investigator).accessToken;
    supToken = generateTokens(supervisor).accessToken;

    testCase = await Case.create({
      title: 'Active Cyber Intrusion',
      description: 'Server breach investigation',
      status: 'active',
      createdBy: investigator._id,
      assignedInvestigators: [investigator._id],
      assignedSupervisor: supervisor._id
    });
  });

  it('POST /api/v1/cases/:caseId/evidence should add evidence with initial chain of custody', async () => {
    const res = await request(app)
      .post(`/api/v1/cases/${testCase._id}/evidence`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({
        title: 'Auth Log Dumps from Gateway',
        description: 'Failed SSH root login attempts recorded between 02:00 and 04:00 UTC.',
        type: 'digital_log',
        source: 'Edge Firewall 10.0.0.1',
        tags: ['firewall', 'ssh', 'bruteforce'],
        initialCustodyNote: 'Extracted directly via forensic image tool.'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      title: 'Auth Log Dumps from Gateway',
      type: 'digital_log',
      source: 'Edge Firewall 10.0.0.1',
      verificationStatus: 'unverified'
    });
    expect(res.body.data.tags).toContain('firewall');
    expect(res.body.data.chainOfCustody).toHaveLength(1);
    expect(res.body.data.chainOfCustody[0]).toMatchObject({
      action: 'COLLECTED',
      note: 'Extracted directly via forensic image tool.'
    });

    // Check Audit Log
    const audit = await AuditLog.findOne({ action: 'EVIDENCE_COLLECTED' });
    expect(audit).not.toBeNull();
    expect(audit.caseId.toString()).toBe(testCase._id.toString());
  });

  it('POST /api/v1/cases/:caseId/evidence/:id/request-verification should update status to pending', async () => {
    const evidence = await Evidence.create({
      caseId: testCase._id,
      title: 'Witness Statement Audio',
      description: 'Audio recording from security officer',
      type: 'testimony',
      source: 'Security Guard Desk',
      collectedBy: investigator._id,
      verificationStatus: 'unverified',
      chainOfCustody: [{ actorId: investigator._id, action: 'COLLECTED', timestamp: new Date(), note: 'Collected' }]
    });

    const res = await request(app)
      .post(`/api/v1/cases/${testCase._id}/evidence/${evidence._id}/request-verification`)
      .set('Authorization', `Bearer ${invToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.verificationStatus).toBe('pending');
    expect(res.body.data.chainOfCustody).toHaveLength(2);
    expect(res.body.data.chainOfCustody[1].action).toBe('VERIFICATION_REQUESTED');
  });

  it('POST /api/v1/cases/:caseId/evidence/:id/verify should succeed for Supervisor and fail for Investigator (403)', async () => {
    const evidence = await Evidence.create({
      caseId: testCase._id,
      title: 'Forensic Memory Dump',
      description: 'Volatile RAM dump from compromised host',
      type: 'digital_log',
      source: 'Host Server 01',
      collectedBy: investigator._id,
      verificationStatus: 'pending',
      chainOfCustody: [{ actorId: investigator._id, action: 'COLLECTED', timestamp: new Date(), note: 'Collected' }]
    });

    // Investigator fails with 403
    const invRes = await request(app)
      .post(`/api/v1/cases/${testCase._id}/evidence/${evidence._id}/verify`)
      .set('Authorization', `Bearer ${invToken}`);

    expect(invRes.status).toBe(403);
    expect(invRes.body.error.code).toBe('FORBIDDEN');

    // Supervisor succeeds
    const supRes = await request(app)
      .post(`/api/v1/cases/${testCase._id}/evidence/${evidence._id}/verify`)
      .set('Authorization', `Bearer ${supToken}`);

    expect(supRes.status).toBe(200);
    expect(supRes.body.data.verificationStatus).toBe('verified');
    expect(supRes.body.data.verifiedBy).not.toBeNull();
    expect(supRes.body.data.verifiedAt).not.toBeNull();

    const audit = await AuditLog.findOne({ action: 'EVIDENCE_VERIFIED' });
    expect(audit).not.toBeNull();
  });

  it('POST /api/v1/cases/:caseId/evidence/:id/reject should require reason and update status to rejected', async () => {
    const evidence = await Evidence.create({
      caseId: testCase._id,
      title: 'Corrupted Packet Capture',
      description: 'PCAP file missing checksums',
      type: 'digital_log',
      source: 'Network TAP',
      collectedBy: investigator._id,
      verificationStatus: 'pending',
      chainOfCustody: [{ actorId: investigator._id, action: 'COLLECTED', timestamp: new Date(), note: 'Collected' }]
    });

    // Rejection without reason fails
    const failRes = await request(app)
      .post(`/api/v1/cases/${testCase._id}/evidence/${evidence._id}/reject`)
      .set('Authorization', `Bearer ${supToken}`)
      .send({});

    expect(failRes.status).toBe(400);

    // Rejection with valid reason succeeds
    const okRes = await request(app)
      .post(`/api/v1/cases/${testCase._id}/evidence/${evidence._id}/reject`)
      .set('Authorization', `Bearer ${supToken}`)
      .send({ rejectionReason: 'PCAP capture truncated and corrupted; cannot confirm integrity.' });

    expect(okRes.status).toBe(200);
    expect(okRes.body.data.verificationStatus).toBe('rejected');
    expect(okRes.body.data.rejectionReason).toBe('PCAP capture truncated and corrupted; cannot confirm integrity.');

    const audit = await AuditLog.findOne({ action: 'EVIDENCE_REJECTED' });
    expect(audit).not.toBeNull();
    expect(audit.metadata.rejectionReason).toBe('PCAP capture truncated and corrupted; cannot confirm integrity.');
  });

  it('POST /api/v1/cases/:caseId/evidence/:id/custody should append custody transfer record', async () => {
    const evidence = await Evidence.create({
      caseId: testCase._id,
      title: 'Physical USB Drive',
      description: 'Kingston 64GB USB found in parking lot',
      type: 'physical',
      source: 'Facility Grounds',
      collectedBy: investigator._id,
      verificationStatus: 'unverified',
      chainOfCustody: [{ actorId: investigator._id, action: 'COLLECTED', timestamp: new Date(), note: 'Secured into evidence bag' }]
    });

    const res = await request(app)
      .post(`/api/v1/cases/${testCase._id}/evidence/${evidence._id}/custody`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({
        action: 'TRANSFERRED_TO_LAB',
        note: 'Handed over to Digital Forensics Lab Unit 4 for hardware imaging.'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.chainOfCustody).toHaveLength(2);
    expect(res.body.data.chainOfCustody[1]).toMatchObject({
      action: 'TRANSFERRED_TO_LAB',
      note: 'Handed over to Digital Forensics Lab Unit 4 for hardware imaging.'
    });

    const audit = await AuditLog.findOne({ action: 'CHAIN_OF_CUSTODY_APPENDED' });
    expect(audit).not.toBeNull();
  });

  it('GET /api/v1/cases/:caseId/evidence should filter and search evidence records', async () => {
    await Evidence.create([
      {
        caseId: testCase._id,
        title: 'Invoice PDF Document',
        description: 'Vendor invoice discrepancy',
        type: 'document',
        source: 'Accounting DB',
        collectedBy: investigator._id,
        verificationStatus: 'verified',
        tags: ['finance', 'pdf']
      },
      {
        caseId: testCase._id,
        title: 'Server Access Log',
        description: 'Apache access log dump',
        type: 'digital_log',
        source: 'Web Server',
        collectedBy: investigator._id,
        verificationStatus: 'unverified',
        tags: ['server', 'apache']
      }
    ]);

    // Filter by type
    const typeRes = await request(app)
      .get(`/api/v1/cases/${testCase._id}/evidence?type=document`)
      .set('Authorization', `Bearer ${invToken}`);

    expect(typeRes.status).toBe(200);
    expect(typeRes.body.data).toHaveLength(1);
    expect(typeRes.body.data[0].type).toBe('document');

    // Filter by verificationStatus
    const statusRes = await request(app)
      .get(`/api/v1/cases/${testCase._id}/evidence?verificationStatus=verified`)
      .set('Authorization', `Bearer ${invToken}`);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data).toHaveLength(1);
    expect(statusRes.body.data[0].title).toBe('Invoice PDF Document');
  });
});
