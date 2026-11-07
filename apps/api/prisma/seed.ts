import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Parcelo database seeding...');

  // 1. Clean existing data in reverse order of foreign keys
  await prisma.notification.deleteMany();
  await prisma.handover.deleteMany();
  await prisma.parcel.deleteMany();
  await prisma.otpSession.deleteMany();
  await prisma.user.deleteMany();
  await prisma.flat.deleteMany();
  await prisma.society.deleteMany();

  // 2. Create Society: Greenwood Heights
  const society = await prisma.society.create({
    data: {
      name: 'Greenwood Heights',
      address: 'Outer Ring Road, Bellandur, Bengaluru, Karnataka 560103',
    },
  });
  console.log(`✅ Created Society: ${society.name} (${society.id})`);

  // 3. Create 3 Flats (A-1204, A-1205, B-402)
  const flatA1204 = await prisma.flat.create({
    data: {
      societyId: society.id,
      tower: 'A',
      number: '1204',
    },
  });

  const flatA1205 = await prisma.flat.create({
    data: {
      societyId: society.id,
      tower: 'A',
      number: '1205',
    },
  });

  const flatB402 = await prisma.flat.create({
    data: {
      societyId: society.id,
      tower: 'B',
      number: '402',
    },
  });

  console.log('✅ Created 3 Flats: Tower A - 1204, Tower A - 1205, Tower B - 402');

  // 4. Create Guard: Ramesh Kumar
  const guard = await prisma.user.create({
    data: {
      name: 'Ramesh Kumar (Guard)',
      phone: '+919876543210',
      role: UserRole.GUARD,
      societyId: society.id,
    },
  });
  console.log(`✅ Created Guard: ${guard.name} (${guard.phone})`);

  // 5. Create Admin: Priya Sharma
  const admin = await prisma.user.create({
    data: {
      name: 'Priya Sharma (Admin)',
      phone: '+919876543211',
      role: UserRole.ADMIN,
      societyId: society.id,
    },
  });
  console.log(`✅ Created Admin: ${admin.name} (${admin.phone})`);

  // 6. Create 2 Residents
  // Resident 1: Arun Patel in A-1204 (Used in Phase 3 acceptance test!)
  const resident1 = await prisma.user.create({
    data: {
      name: 'Arun Patel',
      phone: '+919876543212',
      role: UserRole.RESIDENT,
      societyId: society.id,
      flatId: flatA1204.id,
    },
  });
  console.log(`✅ Created Resident 1: ${resident1.name} (Flat A-1204, ${resident1.phone})`);

  // Resident 2: Sneha Rao in A-1205
  const resident2 = await prisma.user.create({
    data: {
      name: 'Sneha Rao',
      phone: '+919876543213',
      role: UserRole.RESIDENT,
      societyId: society.id,
      flatId: flatA1205.id,
    },
  });
  console.log(`✅ Created Resident 2: ${resident2.name} (Flat A-1205, ${resident2.phone})`);

  console.log('\n✨ Database seeding completed successfully!');
  console.log('---------------------------------------------------------');
  console.log('Credentials for quick login:');
  console.log('Guard:    +919876543210 (Default Dev OTP: 123456)');
  console.log('Admin:    +919876543211 (Default Dev OTP: 123456)');
  console.log('Resident: +919876543212 (Flat A-1204, Default Dev OTP: 123456)');
  console.log('Resident: +919876543213 (Flat A-1205, Default Dev OTP: 123456)');
  console.log('---------------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
