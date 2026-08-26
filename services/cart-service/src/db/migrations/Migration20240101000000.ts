import { Migration } from '@mikro-orm/migrations';

export class Migration20240101000000 extends Migration {
  up(): void {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "carts" (
        "user_id"    VARCHAR(255) NOT NULL,
        "items"      JSONB        NOT NULL DEFAULT '{"userId":"","items":[],"updatedAt":"1970-01-01T00:00:00.000Z"}',
        "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "version"    INTEGER      NOT NULL DEFAULT 1,
        CONSTRAINT "carts_pkey" PRIMARY KEY ("user_id")
      );
    `);
  }

  down(): void {
    this.addSql(`DROP TABLE IF EXISTS "carts";`);
  }
}
