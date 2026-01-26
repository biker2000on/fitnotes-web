CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"name" text,
	"password_hash" text,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#FF5733' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category_id" integer NOT NULL,
	"exercise_type_id" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"weight_increment" integer,
	"default_graph_id" integer,
	"default_rest_time" integer,
	"weight_unit_id" integer DEFAULT 0 NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"exercise_id" integer NOT NULL,
	"workout_date" date NOT NULL,
	"metric_weight" integer NOT NULL,
	"reps" integer NOT NULL,
	"unit" integer DEFAULT 0 NOT NULL,
	"distance" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"is_personal_record" boolean DEFAULT false NOT NULL,
	"is_personal_record_first" boolean DEFAULT false NOT NULL,
	"is_complete" boolean DEFAULT false NOT NULL,
	"is_pending_update" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"workout_group_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text,
	"workout_date" date NOT NULL,
	"color" text,
	"auto_jump_enabled" boolean DEFAULT true NOT NULL,
	"rest_timer_auto_start" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"owner_type_id" integer NOT NULL,
	"owner_id" integer NOT NULL,
	"comment" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_times" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"workout_date" date NOT NULL,
	"start_date_time" timestamp NOT NULL,
	"end_date_time" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"metric" boolean DEFAULT true NOT NULL,
	"first_day_of_week" integer DEFAULT 2 NOT NULL,
	"weight_increment" integer DEFAULT 2500 NOT NULL,
	"body_weight_increment" real,
	"body_weight_goal" integer,
	"body_weight_goal_weight" integer,
	"body_weight_show_in_workout_log" boolean DEFAULT false,
	"estimated_1rm_max_reps_to_include" integer DEFAULT 10,
	"estimated_1rm_max_apply_to_graph" boolean DEFAULT false,
	"track_personal_records" boolean DEFAULT true NOT NULL,
	"mark_sets_complete" boolean DEFAULT true NOT NULL,
	"auto_select_next_set" boolean DEFAULT true,
	"keep_screen_on" boolean DEFAULT true,
	"graph_show_points" boolean DEFAULT true,
	"graph_show_trend_line" boolean DEFAULT true,
	"graph_start_at_zero" boolean DEFAULT false,
	"rest_timer_seconds" integer DEFAULT 90 NOT NULL,
	"rest_timer_vibrate" boolean DEFAULT true,
	"rest_timer_sound" boolean DEFAULT true,
	"rest_timer_volume" real DEFAULT 0.5,
	"rest_timer_auto_start" boolean DEFAULT false,
	"calendar_detail_visible" boolean DEFAULT true,
	"calendar_category_dots_visible" boolean DEFAULT true,
	"calendar_navigation_bar_visible" boolean DEFAULT true,
	"calendar_history_category_dots_visible" boolean DEFAULT true,
	"calendar_history_category_names_visible" boolean DEFAULT true,
	"calendar_history_sets_visible" boolean DEFAULT true,
	"category_sort_order" integer DEFAULT 0,
	"category_show_colours" boolean DEFAULT true,
	"measurement_tracker_initial_load" boolean DEFAULT false,
	"measurement_show_in_workout_log" boolean DEFAULT false,
	"workout_graph_default_graph_type" integer DEFAULT 0,
	"workout_graph_default_time_period" integer DEFAULT 0,
	"analysis_breakdown_breakdown_type" integer DEFAULT 0,
	"analysis_breakdown_time_period" integer DEFAULT 0,
	"exercise_list_detail_type_id" integer DEFAULT 0,
	"workout_timer_auto_start_enabled" boolean DEFAULT false,
	"workout_timer_auto_stop_enabled" boolean DEFAULT false,
	"home_screen_limit_type_id" integer DEFAULT 0,
	"home_screen_limit_value" integer DEFAULT 7,
	"home_screen_category_visibility_id" integer DEFAULT 3,
	"home_screen_skip_empty_dates" boolean DEFAULT false,
	"app_theme_id" integer DEFAULT 0,
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_logs" ADD CONSTRAINT "training_logs_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_logs" ADD CONSTRAINT "training_logs_workout_group_id_workout_groups_id_fk" FOREIGN KEY ("workout_group_id") REFERENCES "public"."workout_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_groups" ADD CONSTRAINT "workout_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_times" ADD CONSTRAINT "workout_times_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;