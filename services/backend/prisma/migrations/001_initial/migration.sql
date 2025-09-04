-- CreateEnum
CREATE TYPE "Role" AS ENUM ('FARMER', 'VERIFIER', 'BUYER', 'ADMIN', 'MODERATOR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "LandOwnership" AS ENUM ('OWNED', 'LEASED', 'SHARECROPPED', 'FAMILY');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('NONE', 'PRIMARY', 'SECONDARY', 'HIGHER_SECONDARY', 'GRADUATION', 'POST_GRADUATION', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "SoilType" AS ENUM ('CLAY', 'SANDY', 'LOAM', 'SILT', 'PEAT', 'CHALK', 'BLACK_COTTON', 'ALLUVIAL', 'RED', 'LATERITE');

-- CreateEnum
CREATE TYPE "IrrigationType" AS ENUM ('DRIP', 'SPRINKLER', 'FLOOD', 'FURROW', 'MICRO_SPRINKLER', 'RAINFED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "avatar" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "role" "Role" NOT NULL DEFAULT 'FARMER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" "Gender",
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "pincode" TEXT,
    "coordinates" JSONB,
    "farmingExperience" INTEGER,
    "landOwnership" "LandOwnership",
    "primaryCrops" TEXT[],
    "farmingMethods" TEXT[],
    "annualIncome" DECIMAL(10,2),
    "familySize" INTEGER,
    "education" "EducationLevel",
    "technicalSkills" TEXT[],
    "languages" TEXT[],
    "bankAccount" TEXT,
    "ifscCode" TEXT,
    "panNumber" TEXT,
    "aadhaarNumber" TEXT,
    "communicationPrefs" JSONB,
    "privacySettings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "address" TEXT,
    "coordinates" JSONB NOT NULL,
    "boundaries" JSONB,
    "area" DECIMAL(10,4) NOT NULL,
    "soilType" "SoilType",
    "irrigationType" "IrrigationType"[],
    "climaticZone" TEXT,
    "elevation" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "registrationNumber" TEXT,
    "surveyNumber" TEXT,
    "revenueVillage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iot_devices" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "model" TEXT,
    "manufacturer" TEXT,
    "farmId" TEXT,
    "location" JSONB,
    "installationDate" TIMESTAMP(3),
    "configuration" JSONB NOT NULL,
    "firmwareVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "batteryLevel" INTEGER,
    "signalStrength" INTEGER,
    "lastSeen" TIMESTAMP(3),
    "protocol" TEXT NOT NULL,
    "endpoint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iot_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_data" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "temperature" DECIMAL(5,2),
    "humidity" DECIMAL(5,2),
    "soilMoisture" DECIMAL(5,2),
    "soilTemperature" DECIMAL(5,2),
    "soilPH" DECIMAL(4,2),
    "soilEC" DECIMAL(8,2),
    "windSpeed" DECIMAL(5,2),
    "windDirection" INTEGER,
    "rainfall" DECIMAL(6,2),
    "solarRadiation" DECIMAL(8,2),
    "uvIndex" DECIMAL(4,2),
    "pressure" DECIMAL(8,2),
    "co2Level" DECIMAL(8,2),
    "nh3Level" DECIMAL(8,2),
    "lightIntensity" DECIMAL(8,2),
    "waterLevel" DECIMAL(6,2),
    "waterFlow" DECIMAL(8,2),
    "waterPressure" DECIMAL(6,2),
    "coordinates" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quality" TEXT NOT NULL DEFAULT 'GOOD',
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensor_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "farms_registrationNumber_key" ON "farms"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "iot_devices_deviceId_key" ON "iot_devices"("deviceId");

-- CreateIndex
CREATE INDEX "sensor_data_deviceId_timestamp_idx" ON "sensor_data"("deviceId", "timestamp");

-- CreateIndex
CREATE INDEX "sensor_data_timestamp_idx" ON "sensor_data"("timestamp");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farms" ADD CONSTRAINT "farms_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_data" ADD CONSTRAINT "sensor_data_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "iot_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
