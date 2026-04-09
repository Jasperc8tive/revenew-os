// Database seeding script - populates initial test data
// Run this after migrations to set up demo organizations and users

import { execSync } from 'child_process';

export async function seedDatabase() {
  execSync('npm run db:seed', {
    stdio: 'inherit',
  });
}

seedDatabase().catch((error) => {
  console.error('Database seeding failed:', error);
  process.exit(1);
});
