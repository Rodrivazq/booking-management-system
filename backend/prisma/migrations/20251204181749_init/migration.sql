-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "funcNumber" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "photoUrl" TEXT,
    "preferences" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "companyName" TEXT NOT NULL DEFAULT 'Sistema de Reservas Corporativo',
    "logoUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#16a34a',
    "secondaryColor" TEXT DEFAULT '#1e293b',
    "deadlineDay" INTEGER NOT NULL DEFAULT 3,
    "deadlineTime" TEXT NOT NULL DEFAULT '23:59',
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "welcomeTitle" TEXT,
    "welcomeMessage" TEXT,
    "loginBackgroundImage" TEXT,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "announcementMessage" TEXT,
    "announcementType" TEXT DEFAULT 'info'
);

-- CreateTable
CREATE TABLE "WeeklyMenu" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStart" TEXT NOT NULL,
    "days" TEXT NOT NULL,
    "breadAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "timeSlot" TEXT NOT NULL,
    "selections" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_funcNumber_key" ON "User"("funcNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyMenu_weekStart_key" ON "WeeklyMenu"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_token_key" ON "PasswordReset"("token");
