-- CreateTable
CREATE TABLE "limite_debit" (
    "cle" TEXT NOT NULL,
    "compteur" INTEGER NOT NULL,
    "expireA" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "limite_debit_pkey" PRIMARY KEY ("cle")
);
