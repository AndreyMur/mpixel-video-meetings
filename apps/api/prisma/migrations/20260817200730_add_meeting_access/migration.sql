-- CreateTable
CREATE TABLE "MeetingAccess" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingAccess_userId_idx" ON "MeetingAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAccess_meetingId_userId_key" ON "MeetingAccess"("meetingId", "userId");

-- AddForeignKey
ALTER TABLE "MeetingAccess" ADD CONSTRAINT "MeetingAccess_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAccess" ADD CONSTRAINT "MeetingAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
