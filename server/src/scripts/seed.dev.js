import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { Case } from '../models/Case.js';
import { AuditLog } from '../models/AuditLog.js';

/**
 * DEV SEED SCRIPT (Synthetic test data for local development only)
 * DO NOT RUN AGAINST PRODUCTION ENVIRONMENTS
 */
async function seedDevData() {
  if (config.isProduction) {
    console.error('ERROR: Seed script cannot run in production environment!');
    process.exit(1);
  }

  try {
    console.log('[Seed] Connecting to development MongoDB...');
    try {
      await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 2000 });
      console.log('[Seed] Connected to local MongoDB.');
    } catch {
      console.log('[Seed] Local MongoDB not found. Starting In-Memory MongoDB for validation...');
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const memServer = await MongoMemoryServer.create();
      await mongoose.connect(memServer.getUri());
      console.log('[Seed] In-Memory MongoDB connected.');
    }

    console.log('[Seed] Clearing existing collections (Dev only)...');
    await Promise.all([
      User.deleteMany({}),
      Case.deleteMany({}),
      AuditLog.deleteMany({})
    ]);

    console.log('[Seed] Creating synthetic user accounts with bcrypt hashes...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123!', salt);

    const admin = await User.create({
      name: 'Dev Admin User',
      email: 'admin@blackbox.local',
      passwordHash,
      role: 'admin',
      status: 'active',
      emailVerified: true,
      identityVerified: true,
      adminProvisioned: true,
      mfaEnabled: false
    });

    const supervisor = await User.create({
      name: 'Senior Supervisor Lee',
      email: 'supervisor@blackbox.local',
      passwordHash,
      role: 'supervisor',
      status: 'active',
      emailVerified: true,
      identityVerified: true,
      organization: 'Digital Forensics Oversight Board',
      professionalEmail: 'supervisor@blackbox.local',
      professionalEmailVerified: true,
      supervisorStatus: 'approved',
      supervisorApprovedAt: new Date(),
      supervisorApprovedBy: admin._id,
      mfaEnabled: false
    });

    const investigator = await User.create({
      name: 'Lead Investigator Vance',
      email: 'investigator@blackbox.local',
      passwordHash,
      role: 'investigator',
      status: 'active',
      emailVerified: true,
      identityVerified: true,
      organization: 'Cyber Crime Investigation Division',
      supervisorStatus: 'none',
      mfaEnabled: false
    });

    console.log('[Seed] Creating initial synthetic case (Draft)...');
    const initialCase = await Case.create({
      title: 'Project Apex Infrastructure Intrusion',
      description: 'Synthetic test investigation: unauthorized SSH session and telemetry exfiltration detected on primary cluster.',
      priority: 'high',
      status: 'draft',
      createdBy: investigator._id,
      assignedInvestigators: [investigator._id],
      assignedSupervisor: supervisor._id
    });

    await AuditLog.create({
      actorId: investigator._id,
      action: 'CASE_CREATED',
      entityType: 'Case',
      entityId: initialCase._id,
      caseId: initialCase._id,
      metadata: { note: 'Synthetic test seed case initialized' },
      ipAddress: '127.0.0.1'
    });

    console.log('✅ Dev database successfully seeded with synthetic credentials:');
    console.log('--------------------------------------------------');
    console.log('Admin (Level 3):        admin@blackbox.local        / Password123!');
    console.log('Supervisor (Level 2):   supervisor@blackbox.local   / Password123!');
    console.log('Investigator (Level 1): investigator@blackbox.local / Password123!');
    console.log('--------------------------------------------------');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]', error);
    process.exit(1);
  }
}

seedDevData();
