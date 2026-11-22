import mongoose from 'mongoose';
import { env } from '../config/env';
import { User } from '../models/user.model';
import { UserRole } from '../constants/roles';
import { hashPassword } from '../utils/password';

export const seedSuperAdmin = async (): Promise<void> => {
  try {
    console.log('[Seed] Connecting to MongoDB...');
    await mongoose.connect(env.MONGO_URI);
    console.log('[Seed] Connected to MongoDB');

    const adminEmail = env.SUPERADMIN_EMAIL.toLowerCase();
    const existingAdmin = await User.findOne({
      $or: [{ email: adminEmail }, { role: UserRole.SUPER_ADMIN }]
    });

    if (existingAdmin) {
      console.log(`[Seed] SUPER_ADMIN already exists: ${existingAdmin.email} (ID: ${existingAdmin._id})`);
    } else {
      console.log(`[Seed] Creating initial SUPER_ADMIN (${adminEmail})...`);
      const passwordHash = await hashPassword(env.SUPERADMIN_PASSWORD);

      const superAdmin = await User.create({
        email: adminEmail,
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        standardId: null,
        createdBy: null
      });

      console.log(`[Seed] SUPER_ADMIN created successfully!`);
      console.log(`  - ID: ${superAdmin._id}`);
      console.log(`  - Email: ${superAdmin.email}`);
      console.log(`  - Role: ${superAdmin.role}`);
      console.log(`  - Default Password: ${env.SUPERADMIN_PASSWORD}`);
    }
  } catch (error) {
    console.error('[Seed] Error during seeding:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('[Seed] Disconnected from MongoDB');
  }
};

// Execute if run directly via tsx/node
if (require.main === module) {
  seedSuperAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
