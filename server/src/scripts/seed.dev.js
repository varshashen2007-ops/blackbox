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
    await mongoose.connect(config.mongodbUri);

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
      status: 'active'
    });

    const supervisor = await User.create({
      name: 'Senior Supervisor Lee',
      email: 'supervisor@blackbox.local',
      passwordHash,
      role: 'supervisor',
      status: 'active'
    });

    const investigator = await User.create({
      name: 'Lead Investigator Vance',
      email: 'investigator@blackbox.local',
      passwordHash,
      role: 'investigator',
      status: 'active'
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
    console.log('Admin:        admin@blackbox.local        / Password123!');
    console.log('Supervisor:   supervisor@blackbox.local   / Password123!');
    console.log('Investigator: investigator@blackbox.local / Password123!');
    console.log('--------------------------------------------------');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]', error);
    process.exit(1);
  }
}

seedDevData();
