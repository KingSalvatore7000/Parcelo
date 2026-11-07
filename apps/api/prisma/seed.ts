
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
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

  for (const user of users) {
    await prisma.user.upsert({
      where: { phone: user.phone },
      update: {
        name: user.name,
        role: user.role,
        societyId: user.societyId,
        flatId: user.flatId,
      },
      create: user,
    });
    console.log(`Demo account ready: ${user.name}`);
  }

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
