CREATE TABLE "vehicles" (
    "id"           TEXT NOT NULL,
    "bus_number"   TEXT NOT NULL,
    "route"        TEXT,
    "vehicle_type" TEXT NOT NULL DEFAULT 'Bus',
    "lat"          DOUBLE PRECISION NOT NULL,
    "lng"          DOUBLE PRECISION NOT NULL,
    "accuracy"     INTEGER,
    "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);