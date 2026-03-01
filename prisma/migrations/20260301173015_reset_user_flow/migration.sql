/*
  Warnings:

  - You are about to drop the column `user_id` on the `Reservation` table. All the data in the column will be lost.
  - You are about to drop the `Review` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `address` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `first_name` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guest_id` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_name` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone_number` to the `Reservation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AdminStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_show_id_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_user_id_fkey";

-- DropIndex
DROP INDEX "Reservation_user_id_idx";

-- AlterTable
ALTER TABLE "Reservation" DROP COLUMN "user_id",
ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "first_name" TEXT NOT NULL,
ADD COLUMN     "guest_id" TEXT NOT NULL,
ADD COLUMN     "last_name" TEXT NOT NULL,
ADD COLUMN     "phone_number" TEXT NOT NULL;

-- DropTable
DROP TABLE "Review";

-- DropTable
DROP TABLE "User";

-- DropEnum
DROP TYPE "UserRole";

-- DropEnum
DROP TYPE "UserStatus";

-- CreateTable
CREATE TABLE "Admin" (
    "user_id" TEXT NOT NULL,
    "firebase_uid" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "status" "AdminStatus" NOT NULL,
    "avatar_key" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_firebase_uid_key" ON "Admin"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "Reservation_guest_id_idx" ON "Reservation"("guest_id");
