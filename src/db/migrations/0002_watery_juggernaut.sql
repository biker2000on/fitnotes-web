CREATE TABLE "measurement_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"measurement_id" integer NOT NULL,
	"date" timestamp NOT NULL,
	"value" real NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"unit_id" integer DEFAULT 0,
	"goal_type" integer,
	"goal_value" real,
	"goal_date" timestamp,
	"sort_order" integer DEFAULT 0,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "measurement_records" ADD CONSTRAINT "measurement_records_measurement_id_measurements_id_fk" FOREIGN KEY ("measurement_id") REFERENCES "public"."measurements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;