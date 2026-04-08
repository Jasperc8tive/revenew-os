// Database seeding script - populates initial test data
// Run this after migrations to set up demo organizations and users

export async function seedDatabase() {
  // TODO: Implement database seeding logic
}

seedDatabase().catch((error) => {
  console.error('Database seeding failed:', error);
  process.exit(1);
});
