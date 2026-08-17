import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const meetings = await prisma.meeting.findMany({
    include: { user: { select: { email: true } } },
  });

  let updated = 0;
  for (const meeting of meetings) {
    const creatorEmail = meeting.user.email;
    if (!meeting.participants.includes(creatorEmail)) {
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { participants: [creatorEmail, ...meeting.participants] },
      });
      updated += 1;
      console.log(`meeting ${meeting.id}: added creator ${creatorEmail}`);
    }
  }

  console.log(`done: ${updated} of ${meetings.length} meetings updated`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
