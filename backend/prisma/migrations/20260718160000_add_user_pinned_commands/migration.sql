-- AddColumn: per-operator command-palette pins (⌘K), in pin order.
ALTER TABLE "users" ADD COLUMN "pinnedCommands" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
