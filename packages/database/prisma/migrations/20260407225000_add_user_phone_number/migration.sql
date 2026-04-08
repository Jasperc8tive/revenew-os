-- Add optional phone number for user-level notification routing
ALTER TABLE "users"
ADD COLUMN "phoneNumber" TEXT;
