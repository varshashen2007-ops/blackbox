import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Case } from '../src/models/Case.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { SupervisorRequest } from '../src/models/SupervisorRequest.js';
import { generateTokens } from '../src/middleware/auth.js';
import { generateTotpCode } from '../src/services/mfa.service.js';

describe('Security, Identity, Role Credibility & Privilege Governance Suite', () => {
  let investigatorA, investigatorB, supervisorA, supervisorB, adminUser;
  let tokenInvA, tokenInvB, tokenSupA, tokenSupB, tokenAdmin;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123!', salt);

    investigatorA = await User.create({
      name: 'Varsha Shenoy',
      email: 'varsha@blackbox.local',
      passwordHash,
      role: 'investigator',
      status: 'active',
      emailVerified: true,
      identityVerified: true
    });

    investigatorB = await User.create({
      name: 'John Watson',
      email: 'watson@blackbox.local',
      passwordHash,
      role: 'investigator',
      status: 'active',
      emailVerified: true
    });

    supervisorA = await User.create({
      name: 'Saraswathy Supervisor',
      email: 'saraswathy@blackbox.local',
      passwordHash,
      role: 'supervisor',
      status: 'active',
      emailVerified: true,
      identityVerified: true,
      supervisorStatus: 'approved',
      organization: 'Forensic Intelligence Division'
    });

    supervisorB = await User.create({
      name: 'Lestrade Supervisor',
      email: 'lestrade@blackbox.local',
      passwordHash,
      role: 'supervisor',
      status: 'active',
      emailVerified: true,
      identityVerified: true,
      supervisorStatus: 'approved'
    });

    adminUser = await User.create({
      name: 'Director Mycroft',
      email: 'mycroft@blackbox.local',
      passwordHash,
      role: 'admin',
      status: 'active',
      emailVerified: true,
      identityVerified: true,
      adminProvisioned: true
    });

    tokenInvA = generateTokens(investigatorA).accessToken;
    tokenInvB = generateTokens(investigatorB).accessToken;
    tokenSupA = generateTokens(supervisorA).accessToken;
    tokenSupB = generateTokens(supervisorB).accessToken;
    tokenAdmin = generateTokens(adminUser).accessToken;
  });

  // ==========================================
  // 1. PUBLIC REGISTRATION & ROLE TAMPERING
  // ==========================================
  describe('1. Registration & Role Escalation Prevention', () => {
    it('Public registration MUST strictly assign investigator role even if admin/supervisor is requested', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Malicious Attacker',
        email: 'attacker@blackbox.local',
        password: 'Password123!',
        role: 'admin',
        securityLevel: 3
      });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('investigator');

      // Verify in DB directly
      const dbUser = await User.findOne({ email: 'attacker@blackbox.local' });
      expect(dbUser.role).toBe('investigator');
      expect(dbUser.adminProvisioned).toBe(false);
      expect(dbUser.supervisorStatus).toBe('none');
    });
  });

  // ==========================================
  // 2. ACCOUNT STATUS & ACCESS LOCKS
  // ==========================================
  describe('2. Suspended & Revoked Account Authentication', () => {
    it('Suspended user cannot authenticate via password login', async () => {
      await User.findByIdAndUpdate(investigatorA._id, { status: 'suspended' });

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'varsha@blackbox.local',
        password: 'Password123!'
      });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('Revoked user cannot authenticate via password login', async () => {
      await User.findByIdAndUpdate(investigatorA._id, { status: 'revoked' });

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'varsha@blackbox.local',
        password: 'Password123!'
      });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_REVOKED');
    });
  });

  // ==========================================
  // 3. TOTP MULTI-FACTOR AUTHENTICATION
  // ==========================================
  describe('3. RFC 6238 TOTP Multi-Factor Authentication', () => {
    it('User can initiate MFA setup, verify TOTP code, and activate MFA', async () => {
      // Step 1: Initiate setup
      const setupRes = await request(app)
        .post('/api/v1/auth/mfa/setup')
        .set('Authorization', `Bearer ${tokenInvA}`);

      expect(setupRes.status).toBe(200);
      expect(setupRes.body.data).toHaveProperty('secret');
      expect(setupRes.body.data).toHaveProperty('otpAuthUri');

      const secret = setupRes.body.data.secret;

      // Step 2: Confirm with valid 6-digit TOTP code
      const validCode = generateTotpCode(secret);
      const confirmRes = await request(app)
        .post('/api/v1/auth/mfa/confirm')
        .set('Authorization', `Bearer ${tokenInvA}`)
        .send({ code: validCode });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.data.user.mfaEnabled).toBe(true);

      // Verify Audit Log
      const audit = await AuditLog.findOne({ action: 'MFA_ENABLED', actorId: investigatorA._id });
      expect(audit).not.toBeNull();
    });

    it('Account with MFA enabled triggers challenge on login and completes upon valid code', async () => {
      // Enable MFA on supervisorA
      const { generateMfaSecret } = await import('../src/services/mfa.service.js');
      const secret = generateMfaSecret();
      await User.findByIdAndUpdate(supervisorA._id, { mfaEnabled: true, mfaSecret: secret });

      // Step 1: Password login triggers MFA challenge
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'saraswathy@blackbox.local',
        password: 'Password123!'
      });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.mfaRequired).toBe(true);
      expect(loginRes.body.data).toHaveProperty('tempToken');

      const tempToken = loginRes.body.data.tempToken;

      // Step 2: Reject invalid MFA code
      const invalidRes = await request(app).post('/api/v1/auth/login/mfa').send({
        tempToken,
        code: '000000'
      });
      expect(invalidRes.status).toBe(401);
      expect(invalidRes.body.error.code).toBe('INVALID_MFA_CODE');

      // Step 3: Accept valid TOTP code
      const validCode = generateTotpCode(secret);
      const validRes = await request(app).post('/api/v1/auth/login/mfa').send({
        tempToken,
        code: validCode
      });

      expect(validRes.status).toBe(200);
      expect(validRes.body.data.tokens).toHaveProperty('accessToken');
      expect(validRes.body.data.user.email).toBe('saraswathy@blackbox.local');
    });
  });

  // ==========================================
  // 4. SUPERVISOR APPROVAL & REVOCATION WORKFLOW
  // ==========================================
  describe('4. Supervisor Request & Approval Workflow', () => {
    it('Investigator can submit supervisor request; status becomes pending', async () => {
      const res = await request(app)
        .post('/api/v1/supervisor/request')
        .set('Authorization', `Bearer ${tokenInvA}`)
        .send({
          fullName: 'Varsha Shenoy',
          organization: 'Digital Forensics Oversight',
          professionalTitle: 'Senior Forensic Investigator',
          professionalEmail: 'varsha.forensics@agency.gov',
          reason: 'Lead investigator on major enterprise intrusion cases requiring verification authority.',
          credentialReference: 'GCFE-2024-9988'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.organization).toBe('Digital Forensics Oversight');

      const user = await User.findById(investigatorA._id);
      expect(user.supervisorStatus).toBe('pending');
    });

    it('Non-admin cannot approve supervisor request (403 Forbidden)', async () => {
      const reqDoc = await SupervisorRequest.create({
        userId: investigatorA._id,
        fullName: 'Varsha Shenoy',
        professionalEmail: 'varsha@blackbox.local',
        organization: 'Forensic Unit',
        professionalTitle: 'Lead',
        reason: 'Legitimate operational need for review access',
        status: 'pending'
      });

      const res = await request(app)
        .post(`/api/v1/supervisor/admin/requests/${reqDoc._id}/approve`)
        .set('Authorization', `Bearer ${tokenInvB}`);

      expect(res.status).toBe(403);
    });

    it('Admin can approve supervisor request; user role becomes supervisor with level 2', async () => {
      const reqDoc = await SupervisorRequest.create({
        userId: investigatorA._id,
        fullName: 'Varsha Shenoy',
        professionalEmail: 'varsha@blackbox.local',
        organization: 'Cyber Defense Agency',
        professionalTitle: 'Senior Analyst',
        reason: 'Operational review need',
        status: 'pending'
      });

      const res = await request(app)
        .post(`/api/v1/supervisor/admin/requests/${reqDoc._id}/approve`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ reviewNotes: 'Credentials verified and confirmed with agency directory' });

      expect(res.status).toBe(200);

      const updatedUser = await User.findById(investigatorA._id);
      expect(updatedUser.role).toBe('supervisor');
      expect(updatedUser.supervisorStatus).toBe('approved');
      expect(updatedUser.supervisorApprovedBy.toString()).toBe(adminUser._id.toString());
      expect(updatedUser.securityLevel).toBe(2);

      // Verify audit log
      const audit = await AuditLog.findOne({ action: 'SUPERVISOR_APPROVED', entityId: investigatorA._id });
      expect(audit).not.toBeNull();
    });

    it('Admin can revoke supervisor privileges; user role reverts to investigator', async () => {
      const res = await request(app)
        .post(`/api/v1/supervisor/admin/users/${supervisorA._id}/revoke`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ reason: 'Reassignment to non-supervisory division' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('investigator');
      expect(res.body.data.user.supervisorStatus).toBe('revoked');

      const user = await User.findById(supervisorA._id);
      expect(user.role).toBe('investigator');
    });
  });

  // ==========================================
  // 5. PRIVILEGE ESCALATION ATTEMPTS
  // ==========================================
  describe('5. Privilege Escalation Hardening', () => {
    it('Investigator cannot access admin user-role management API (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${investigatorA._id}/role`)
        .set('Authorization', `Bearer ${tokenInvA}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(403);
    });

    it('Supervisor cannot access admin user-role management API (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${supervisorA._id}/role`)
        .set('Authorization', `Bearer ${tokenSupA}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // 6. SCENARIO ACCEPTANCE: CASE VISIBILITY & REVIEW QUEUE
  // ==========================================
  describe('6. Full Case Assignment & Supervisor Review Scenario', () => {
    it('End-to-End: Varsha creates Sherlock case assigned to Saraswathy -> Saraswathy reviews -> Lestrade blocked -> Admin accesses', async () => {
      // Step 1: Varsha (Investigator) creates case assigned to Saraswathy
      const createRes = await request(app)
        .post('/api/v1/cases')
        .set('Authorization', `Bearer ${tokenInvA}`)
        .send({
          title: 'SHERLOCK HOLMES INTRUSION AUDIT',
          description: 'High-profile forensic audit of unauthorized access.',
          priority: 'high',
          assignedSupervisor: supervisorA._id.toString(),
          assignedInvestigators: [investigatorA._id.toString()]
        });

      expect(createRes.status).toBe(201);
      const sherlockCase = createRes.body.data;
      expect(sherlockCase.title).toBe('SHERLOCK HOLMES INTRUSION AUDIT');
      expect(sherlockCase.assignedSupervisor.name).toBe('Saraswathy Supervisor');

      // Step 2: Case appears in Varsha (Investigator) cases list
      const invListRes = await request(app)
        .get('/api/v1/cases')
        .set('Authorization', `Bearer ${tokenInvA}`);

      expect(invListRes.status).toBe(200);
      const foundInInvList = invListRes.body.data.some((c) => (c._id || c.id) === (sherlockCase._id || sherlockCase.id));
      expect(foundInInvList).toBe(true);

      // Step 3: Transition case to under_review -> appears in Saraswathy review queue
      await request(app)
        .post(`/api/v1/cases/${sherlockCase.id}/transition`)
        .set('Authorization', `Bearer ${tokenInvA}`)
        .send({ targetStatus: 'active' });

      await request(app)
        .post(`/api/v1/cases/${sherlockCase.id}/transition`)
        .set('Authorization', `Bearer ${tokenInvA}`)
        .send({ targetStatus: 'under_review', reason: 'Evidence collection phase complete, ready for supervisor review' });

      // Saraswathy checks review queue
      const supQueueRes = await request(app)
        .get('/api/v1/cases?requiresReview=true')
        .set('Authorization', `Bearer ${tokenSupA}`);

      expect(supQueueRes.status).toBe(200);
      const foundInReview = supQueueRes.body.data.some((c) => (c._id || c.id) === (sherlockCase._id || sherlockCase.id));
      expect(foundInReview).toBe(true);

      // Step 4: Unrelated Supervisor (Lestrade) CANNOT see the case in their review queue or access it
      const lestradeQueueRes = await request(app)
        .get('/api/v1/cases?requiresReview=true')
        .set('Authorization', `Bearer ${tokenSupB}`);

      expect(lestradeQueueRes.status).toBe(200);
      const foundInLestradeQueue = lestradeQueueRes.body.data.some((c) => (c._id || c.id) === (sherlockCase._id || sherlockCase.id));
      expect(foundInLestradeQueue).toBe(false);

      // Direct case ID access by unrelated supervisor
      const directRes = await request(app)
        .get(`/api/v1/cases/${sherlockCase.id}`)
        .set('Authorization', `Bearer ${tokenSupB}`);

      expect(directRes.status).toBe(403);
      expect(directRes.body.error.code).toBe('FORBIDDEN');

      // Step 5: Admin (Director Mycroft) can access the case directly
      const adminRes = await request(app)
        .get(`/api/v1/cases/${sherlockCase.id}`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(adminRes.status).toBe(200);
      expect(adminRes.body.data.title).toBe('SHERLOCK HOLMES INTRUSION AUDIT');
    });
  });
});
