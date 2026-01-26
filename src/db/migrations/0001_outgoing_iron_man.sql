CREATE TABLE "routine_section_exercise_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_exercise_id" integer NOT NULL,
	"metric_weight" integer,
	"reps" integer,
	"distance" integer,
	"duration_seconds" integer,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "routine_section_exercises" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"exercise_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0,
	"rest_timer_seconds" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "routine_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"routine_id" integer NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "routines" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "routine_section_exercise_sets" ADD CONSTRAINT "routine_section_exercise_sets_section_exercise_id_routine_section_exercises_id_fk" FOREIGN KEY ("section_exercise_id") REFERENCES "public"."routine_section_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_section_exercises" ADD CONSTRAINT "routine_section_exercises_section_id_routine_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."routine_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_sections" ADD CONSTRAINT "routine_sections_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;