import cron from "node-cron";
import { AppDataSource } from "../data-source";
import { Meeting } from "../entity/Meeting";
import { Training } from "../entity/Training";
import { Member } from "../entity/Member";
import { Attendance } from "../entity/Attendance";
import { AttendanceStatusEnum } from "../dto/mobile/Attendance.dto";

const meetingRepo = AppDataSource.getMongoRepository(Meeting);
const trainingRepo = AppDataSource.getMongoRepository(Training);
const memberRepo = AppDataSource.getMongoRepository(Member);
const attendanceRepo = AppDataSource.getMongoRepository(Attendance);

cron.schedule("*/5 * * * *", async () => {

  const now = new Date();

  const expiredMeetings = await meetingRepo.find({
    where: {
      isDelete: 0,
      isActive: 1,
      latePunchTime: { $lt: now } as any
    }
  });

  for (const meeting of expiredMeetings) {

    const members = await memberRepo.find({
      where: {
        chapter: { $in: meeting.chapters } as any,
        isActive: 1,
        isDelete: 0
      },
      select: { id: true }
    });

    const memberIds = members.map(m => m.id);

    const existing = await attendanceRepo.find({
      where: {
        sourceId: meeting._id,
        sourceType: "MEETING",
        memberId: { $in: memberIds } as any,
        isDelete: 0
      },
      select: { memberId: true }
    });

    const existingIds = new Set(
      existing.map(e => String(e.memberId))
    );

    const bulkDocs = memberIds
      .filter(id => !existingIds.has(String(id)))
      .map(id => ({
        memberId: id,
        sourceId: meeting._id,
        sourceType: "MEETING",
        status: AttendanceStatusEnum.ABSENT,
        isActive: 1,
        isDelete: 0,
        createdAt: new Date()
      }));

    if (bulkDocs.length) {
      await attendanceRepo.insertMany(bulkDocs);
    }
  }

  const expiredTrainings = await trainingRepo.find({
    where: {
      isDelete: 0,
      isActive: 1,
      trainingDateTime: { $lt: now } as any
    }
  });

  for (const training of expiredTrainings) {

    const members = await memberRepo.find({
      where: {
        chapter: { $in: training.chapterIds } as any,
        isActive: 1,
        isDelete: 0
      },
      select: { id: true }
    });

    const memberIds = members.map(m => m.id);

    const existing = await attendanceRepo.find({
      where: {
        sourceId: training.id,
        sourceType: "TRAINING",
        memberId: { $in: memberIds } as any,
        isDelete: 0
      },
      select: { memberId: true }
    });

    const existingIds = new Set(
      existing.map(e => String(e.memberId))
    );

    const bulkDocs = memberIds
      .filter(id => !existingIds.has(String(id)))
      .map(id => ({
        memberId: id,
        sourceId: training.id,
        sourceType: "TRAINING",
        status: AttendanceStatusEnum.ABSENT,
        isActive: 1,
        isDelete: 0,
        createdAt: new Date()
      }));

    if (bulkDocs.length) {
      await attendanceRepo.insertMany(bulkDocs);
    }
  }

});

