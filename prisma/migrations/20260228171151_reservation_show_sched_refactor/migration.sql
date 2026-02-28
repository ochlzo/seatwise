-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ShowStatus" AS ENUM ('UPCOMING', 'DRAFT', 'OPEN', 'CLOSED', 'ON_GOING', 'CANCELLED', 'POSTPONED');

-- CreateEnum
CREATE TYPE "SeatmapStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ColorCodes" AS ENUM ('NO COLOR', '#ffd700', '#e005b9', '#111184', '#800020', '#046307');

-- CreateEnum
CREATE TYPE "SeatStatus" AS ENUM ('OPEN', 'RESERVED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'GCASH', 'MAYA', 'CREDIT_CARD', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "User" (
    "user_id" TEXT NOT NULL,
    "firebase_uid" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL,
    "role" "UserRole" NOT NULL,
    "avatar_key" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "Show" (
    "show_id" TEXT NOT NULL,
    "show_name" TEXT NOT NULL,
    "show_description" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "show_status" "ShowStatus" NOT NULL,
    "show_start_date" DATE NOT NULL,
    "show_end_date" DATE NOT NULL,
    "show_image_key" TEXT,
    "seatmap_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Show_pkey" PRIMARY KEY ("show_id")
);

-- CreateTable
CREATE TABLE "Sched" (
    "sched_id" TEXT NOT NULL,
    "sched_date" DATE NOT NULL,
    "sched_start_time" TIME(6) NOT NULL,
    "sched_end_time" TIME(6) NOT NULL,
    "show_id" TEXT NOT NULL,
    "category_set_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sched_pkey" PRIMARY KEY ("sched_id")
);

-- CreateTable
CREATE TABLE "Seatmap" (
    "seatmap_id" TEXT NOT NULL,
    "seatmap_name" TEXT NOT NULL,
    "seatmap_json" JSONB NOT NULL,
    "seatmap_status" "SeatmapStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seatmap_pkey" PRIMARY KEY ("seatmap_id")
);

-- CreateTable
CREATE TABLE "Seat" (
    "seat_id" TEXT NOT NULL,
    "seat_number" TEXT NOT NULL,
    "seatmap_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("seat_id")
);

-- CreateTable
CREATE TABLE "SeatCategory" (
    "seat_category_id" TEXT NOT NULL,
    "category_name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "color_code" "ColorCodes" NOT NULL,
    "seatmap_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeatCategory_pkey" PRIMARY KEY ("seat_category_id")
);

-- CreateTable
CREATE TABLE "CategorySet" (
    "category_set_id" TEXT NOT NULL,
    "set_name" TEXT NOT NULL,
    "show_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategorySet_pkey" PRIMARY KEY ("category_set_id")
);

-- CreateTable
CREATE TABLE "CategorySetItem" (
    "category_set_id" TEXT NOT NULL,
    "seat_category_id" TEXT NOT NULL,

    CONSTRAINT "CategorySetItem_pkey" PRIMARY KEY ("category_set_id","seat_category_id")
);

-- CreateTable
CREATE TABLE "Set" (
    "set_id" TEXT NOT NULL,
    "sched_id" TEXT NOT NULL,
    "seat_category_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Set_pkey" PRIMARY KEY ("set_id")
);

-- CreateTable
CREATE TABLE "SeatAssignment" (
    "seat_assignment_id" TEXT NOT NULL,
    "seat_status" "SeatStatus" NOT NULL DEFAULT 'OPEN',
    "seat_id" TEXT NOT NULL,
    "sched_id" TEXT NOT NULL,
    "set_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeatAssignment_pkey" PRIMARY KEY ("seat_assignment_id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "reservation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "show_id" TEXT NOT NULL,
    "sched_id" TEXT NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("reservation_id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "payment_id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reference_no" TEXT,
    "screenshot_url" TEXT,
    "paid_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "reserved_seats" (
    "res_seats_id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "seat_assignment_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reserved_seats_pkey" PRIMARY KEY ("res_seats_id")
);

-- CreateTable
CREATE TABLE "Review" (
    "review_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "show_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("review_id")
);

-- CreateTable
CREATE TABLE "playing_with_neon" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "value" REAL,

    CONSTRAINT "playing_with_neon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_firebase_uid_key" ON "User"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Show_show_name_key" ON "Show"("show_name");

-- CreateIndex
CREATE INDEX "Sched_show_id_idx" ON "Sched"("show_id");

-- CreateIndex
CREATE INDEX "Sched_category_set_id_idx" ON "Sched"("category_set_id");

-- CreateIndex
CREATE UNIQUE INDEX "Seatmap_seatmap_name_key" ON "Seatmap"("seatmap_name");

-- CreateIndex
CREATE INDEX "Seat_seatmap_id_idx" ON "Seat"("seatmap_id");

-- CreateIndex
CREATE UNIQUE INDEX "Seat_seatmap_id_seat_number_key" ON "Seat"("seatmap_id", "seat_number");

-- CreateIndex
CREATE INDEX "SeatCategory_seatmap_id_idx" ON "SeatCategory"("seatmap_id");

-- CreateIndex
CREATE UNIQUE INDEX "SeatCategory_seatmap_id_category_name_price_color_code_key" ON "SeatCategory"("seatmap_id", "category_name", "price", "color_code");

-- CreateIndex
CREATE INDEX "CategorySet_show_id_idx" ON "CategorySet"("show_id");

-- CreateIndex
CREATE UNIQUE INDEX "CategorySet_show_id_set_name_key" ON "CategorySet"("show_id", "set_name");

-- CreateIndex
CREATE INDEX "CategorySetItem_seat_category_id_idx" ON "CategorySetItem"("seat_category_id");

-- CreateIndex
CREATE INDEX "Set_sched_id_idx" ON "Set"("sched_id");

-- CreateIndex
CREATE INDEX "Set_seat_category_id_idx" ON "Set"("seat_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "Set_sched_id_seat_category_id_key" ON "Set"("sched_id", "seat_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "Set_set_id_sched_id_key" ON "Set"("set_id", "sched_id");

-- CreateIndex
CREATE INDEX "SeatAssignment_sched_id_idx" ON "SeatAssignment"("sched_id");

-- CreateIndex
CREATE INDEX "SeatAssignment_seat_id_idx" ON "SeatAssignment"("seat_id");

-- CreateIndex
CREATE INDEX "SeatAssignment_set_id_idx" ON "SeatAssignment"("set_id");

-- CreateIndex
CREATE UNIQUE INDEX "SeatAssignment_seat_id_sched_id_key" ON "SeatAssignment"("seat_id", "sched_id");

-- CreateIndex
CREATE INDEX "Reservation_user_id_idx" ON "Reservation"("user_id");

-- CreateIndex
CREATE INDEX "Reservation_show_id_idx" ON "Reservation"("show_id");

-- CreateIndex
CREATE INDEX "Reservation_sched_id_idx" ON "Reservation"("sched_id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reservation_id_key" ON "Payment"("reservation_id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_no_key" ON "Payment"("reference_no");

-- CreateIndex
CREATE INDEX "Payment_reservation_id_idx" ON "Payment"("reservation_id");

-- CreateIndex
CREATE INDEX "reserved_seats_reservation_id_idx" ON "reserved_seats"("reservation_id");

-- CreateIndex
CREATE INDEX "reserved_seats_seat_assignment_id_idx" ON "reserved_seats"("seat_assignment_id");

-- CreateIndex
CREATE INDEX "Review_user_id_idx" ON "Review"("user_id");

-- CreateIndex
CREATE INDEX "Review_show_id_idx" ON "Review"("show_id");

-- CreateIndex
CREATE UNIQUE INDEX "Review_user_id_show_id_key" ON "Review"("user_id", "show_id");

-- AddForeignKey
ALTER TABLE "Show" ADD CONSTRAINT "Show_seatmap_id_fkey" FOREIGN KEY ("seatmap_id") REFERENCES "Seatmap"("seatmap_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sched" ADD CONSTRAINT "Sched_category_set_id_fkey" FOREIGN KEY ("category_set_id") REFERENCES "CategorySet"("category_set_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sched" ADD CONSTRAINT "Sched_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "Show"("show_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_seatmap_id_fkey" FOREIGN KEY ("seatmap_id") REFERENCES "Seatmap"("seatmap_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatCategory" ADD CONSTRAINT "SeatCategory_seatmap_id_fkey" FOREIGN KEY ("seatmap_id") REFERENCES "Seatmap"("seatmap_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategorySet" ADD CONSTRAINT "CategorySet_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "Show"("show_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategorySetItem" ADD CONSTRAINT "CategorySetItem_category_set_id_fkey" FOREIGN KEY ("category_set_id") REFERENCES "CategorySet"("category_set_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategorySetItem" ADD CONSTRAINT "CategorySetItem_seat_category_id_fkey" FOREIGN KEY ("seat_category_id") REFERENCES "SeatCategory"("seat_category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Set" ADD CONSTRAINT "Set_sched_id_fkey" FOREIGN KEY ("sched_id") REFERENCES "Sched"("sched_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Set" ADD CONSTRAINT "Set_seat_category_id_fkey" FOREIGN KEY ("seat_category_id") REFERENCES "SeatCategory"("seat_category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAssignment" ADD CONSTRAINT "SeatAssignment_sched_id_fkey" FOREIGN KEY ("sched_id") REFERENCES "Sched"("sched_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAssignment" ADD CONSTRAINT "SeatAssignment_seat_id_fkey" FOREIGN KEY ("seat_id") REFERENCES "Seat"("seat_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAssignment" ADD CONSTRAINT "SeatAssignment_set_id_sched_id_fkey" FOREIGN KEY ("set_id", "sched_id") REFERENCES "Set"("set_id", "sched_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "Show"("show_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_sched_id_fkey" FOREIGN KEY ("sched_id") REFERENCES "Sched"("sched_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "Reservation"("reservation_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserved_seats" ADD CONSTRAINT "reserved_seats_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "Reservation"("reservation_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserved_seats" ADD CONSTRAINT "reserved_seats_seat_assignment_id_fkey" FOREIGN KEY ("seat_assignment_id") REFERENCES "SeatAssignment"("seat_assignment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "Show"("show_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
