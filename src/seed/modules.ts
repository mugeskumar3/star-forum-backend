import { AppDataSource } from "../data-source";
import { Modules } from "../entity/Modules";

export async function seedDefaultModules() {
  const moduleRepo = AppDataSource.getMongoRepository(Modules);

  // ✅ Check if any module already exists
  const count = await moduleRepo.count();

  if (count > 0) {
    console.log("ℹ️ Modules already exist. Skipping seeding.");
    return;
  }

  const modules = [
    "Dashboard",
    "Roles & Permissions",
    "Admin Registration",
    "Organisation",
    "Badge Creation",
    "Award",
    "Business Category",
    "Zone Creation",
    "Chapter Creation",
    "Members Registration",
    "Meeting Creation",
    "Attendance List",
    "General Update",
    "Community Update",
    "Star Update",
    "Points",
    "Training",
    "Shop Category",
    "Shop Product",
    "Shop Order",
    "Log Report",
    "Renewal Report",
    "Chapter Report",
    "121’s Report",
    "Referral’s Report",
    "Visitor’s Report",
    "Chief Guest’s Report",
    "Thank you Slip",
    "Power Date",
    "Testimonials",
    "Chief Guest List",
    "Locations"
  ];

  const moduleEntities = modules.map(name => {
    const module = new Modules();
    module.name = name;
    module.isActive = 1;
    module.isDelete = 0;
    return module;
  });

  await moduleRepo.save(moduleEntities);

  console.log("🌟 Default Modules seeded successfully");
}
