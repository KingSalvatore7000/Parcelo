
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Demo@1234';

async function main() {
  // The demo accounts share a password that is in this file
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo accounts with NODE_ENV=production.');
  }
  console.log('Starting Parcelo database seeding...');

  // Create or find the demo society
  let society = await prisma.society.findFirst({
    where: { name: 'Greenwood Heights' },
  });

  if (!society) {
    society = await prisma.society.create({
      data: {
        name: 'Greenwood Heights',
        address: 'Outer Ring Road, Bellandur, Bengaluru, Karnataka 560103',
      },
    });
  }

  console.log(`Society ready: ${society.name}`);

  // Create or find demo flats
  const flatA1204 = await prisma.flat.upsert({
    where: {
      societyId_tower_number: {
        societyId: society.id,
        tower: 'A',
        number: '1204',
      },
    },
    update: {},
    create: { societyId: society.id, tower: 'A', number: '1204' },
  });

  const flatA1205 = await prisma.flat.upsert({
    where: {
      societyId_tower_number: {
        societyId: society.id,
        tower: 'A',
        number: '1205',
      },
    },
    update: {},
    create: { societyId: society.id, tower: 'A', number: '1205' },
  });

  await prisma.flat.upsert({
    where: {
      societyId_tower_number: {
        societyId: society.id,
        tower: 'B',
        number: '402',
      },
    },
    update: {},
    create: { societyId: society.id, tower: 'B', number: '402' },
  });

  // Create or update demo users
  const users = [
    {
      name: 'Ramesh Kumar (Guard)',
      phone: '+919876543210',
      role: UserRole.GUARD,
      societyId: society.id,
      flatId: null,
    },
    {
      name: 'Priya Sharma (Admin)',
      phone: '+919876543211',
      role: UserRole.ADMIN,
      societyId: society.id,
      flatId: null,
    },
    {
      name: 'Arun Patel',
      phone: '+919876543212',
      role: UserRole.RESIDENT,
      societyId: society.id,
      flatId: flatA1204.id,
    },
    {
      name: 'Sneha Rao',
      phone: '+919876543213',
      role: UserRole.RESIDENT,
      societyId: society.id,
      flatId: flatA1205.id,
    },
  ];

  // Demo accounts share one password (apps/web/src/config.ts DEMO_PASSWORD); never use these in production
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  for (const user of users) {
    await prisma.user.upsert({
      where: { phone: user.phone },
      update: {
        name: user.name,
        role: user.role,
        societyId: user.societyId,
        flatId: user.flatId,
        passwordHash,
        mustChangePassword: false,
      },
      create: { ...user, passwordHash, mustChangePassword: false },
    });
    console.log(`Demo account ready: ${user.name} (${user.phone})`);
  }
  console.log(`Demo password for all of them: ${DEMO_PASSWORD}`);

  console.log('Database seeding completed!');
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
