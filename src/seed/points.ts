import { AppDataSource } from "../data-source";
import { Points } from "../entity/Points";

export const seedPoints = async () => {
  const repo = AppDataSource.getMongoRepository(Points);

  const count = await repo.countDocuments();
  if (count > 0) {
    // console.info("✅ Points already seeded");
    return;
  }

  await repo.insertMany([
    {
      key: "one_to_one",
      name: "121s",
      description: "One-to-One Meetings",
      value: 0,
      order: 1
    },
    {
      key: "referrals",
      name: "Referrals",
      description: "Business Referrals",
      value: 0,
      order: 2
    },
    {
      key: "weekly_meetings",
      name: "Weekly Meetings",
      description: "Attendance Points",
      value: 0,
      order: 3
    },
    {
      key: "thank_you_notes",
      name: "Thank You Notes",
      description: "Gratitude Points",
      value: 0,
      order: 4
    },
    {
      key: "visitors",
      name: "Visitors",
      description: "New Guests Invited",
      value: 0,
      order: 5
    },
    {
      key: "chief_guests",
      name: "Chief Guests",
      description: "Distinguished Guests",
      value: 0,
      order: 6
    },
    {
      key: "power_dates",
      name: "Power Dates",
      description: "Strategic Meetings",
      value: 0,
      order: 7
    },
    {
      key: "inductions",
      name: "Inductions",
      description: "New Member Welcomes",
      value: 0,
      order: 8
    }
  ]);

  console.log("✅ Points seeded successfully");
};
