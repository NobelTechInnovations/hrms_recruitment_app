CREATE TABLE `application_events` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`from_stage` text,
	`to_stage` text NOT NULL,
	`actor_user_id` text,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `application_events_app_idx` ON `application_events` (`application_id`);--> statement-breakpoint
CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`company_id` text NOT NULL,
	`resume_id` text,
	`uploaded_resume_doc_id` text,
	`cover_note` text,
	`stage` text DEFAULT 'applied' NOT NULL,
	`source` text DEFAULT 'direct' NOT NULL,
	`match_score` integer,
	`rejection_reason` text,
	`first_response_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applications_job_candidate_unique` ON `applications` (`job_id`,`candidate_id`);--> statement-breakpoint
CREATE INDEX `applications_company_idx` ON `applications` (`company_id`);--> statement-breakpoint
CREATE INDEX `applications_candidate_idx` ON `applications` (`candidate_id`);--> statement-breakpoint
CREATE TABLE `assessment_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`question_ids` text NOT NULL,
	`answers` text DEFAULT '{}' NOT NULL,
	`started_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`submitted_at` integer,
	`score_percent` integer,
	`passed` integer,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`topic_breakdown` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attempts_candidate_idx` ON `assessment_attempts` (`candidate_id`);--> statement-breakpoint
CREATE INDEX `attempts_assessment_idx` ON `assessment_attempts` (`assessment_id`);--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`level` integer NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`duration_minutes` integer DEFAULT 20 NOT NULL,
	`passing_percent` integer DEFAULT 60 NOT NULL,
	`questions_per_attempt` integer DEFAULT 10 NOT NULL,
	`retake_cooldown_days` integer DEFAULT 7 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`details` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`full_name` text NOT NULL,
	`headline` text,
	`summary` text,
	`photo_key` text,
	`date_of_birth` text,
	`gender` text,
	`current_location` text,
	`preferred_locations` text DEFAULT '[]' NOT NULL,
	`industry` text,
	`current_company` text,
	`current_designation` text,
	`experience_years` real DEFAULT 0 NOT NULL,
	`current_ctc` real,
	`expected_ctc` real,
	`notice_period_days` integer,
	`availability` text DEFAULT 'within_30' NOT NULL,
	`work_mode_preference` text DEFAULT 'any' NOT NULL,
	`skills` text DEFAULT '[]' NOT NULL,
	`languages` text DEFAULT '[]' NOT NULL,
	`linkedin_url` text,
	`portfolio_url` text,
	`other_profile_url` text,
	`masked_email` text NOT NULL,
	`identity_verified_at` integer,
	`education_verified_at` integer,
	`experience_verified_at` integer,
	`salary_verified_at` integer,
	`location_verified_at` integer,
	`level1_qualified_at` integer,
	`level1_score` integer,
	`level2_qualified_at` integer,
	`level2_category` text,
	`level2_score` integer,
	`profile_visibility` text DEFAULT 'all_verified' NOT NULL,
	`appear_in_search` integer DEFAULT true NOT NULL,
	`allow_recruiter_contact` integer DEFAULT true NOT NULL,
	`allow_recommendations` integer DEFAULT true NOT NULL,
	`shareable_doc_types` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `candidates_user_id_unique` ON `candidates` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `candidates_masked_email_unique` ON `candidates` (`masked_email`);--> statement-breakpoint
CREATE INDEX `candidates_industry_idx` ON `candidates` (`industry`);--> statement-breakpoint
CREATE TABLE `certifications` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`name` text NOT NULL,
	`issuer` text,
	`year` integer,
	`credential_url` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`legal_name` text,
	`registration_number` text,
	`gst_applicable` integer DEFAULT true NOT NULL,
	`gst_number` text,
	`pan` text,
	`address_line` text,
	`city` text,
	`state` text,
	`country` text DEFAULT 'India' NOT NULL,
	`pincode` text,
	`website` text,
	`business_email` text NOT NULL,
	`contact_name` text,
	`contact_designation` text,
	`contact_phone` text,
	`contact_email` text,
	`industry` text,
	`size` text,
	`hiring_requirements` text,
	`description` text,
	`billing_name` text,
	`billing_address` text,
	`billing_email` text,
	`billing_gst_number` text,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`verification_note` text,
	`verification_submitted_at` integer,
	`verified_at` integer,
	`masked_email` text NOT NULL,
	`plan_code` text DEFAULT 'success' NOT NULL,
	`billing_cycle` text DEFAULT 'monthly' NOT NULL,
	`subscription_renews_at` integer,
	`featured_until` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_masked_email_unique` ON `companies` (`masked_email`);--> statement-breakpoint
CREATE TABLE `company_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`token` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invited_by_user_id` text NOT NULL,
	`accepted_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `company_invites_token_unique` ON `company_invites` (`token`);--> statement-breakpoint
CREATE TABLE `company_members` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `company_members_user_unique` ON `company_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `company_members_company_idx` ON `company_members` (`company_id`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`job_id` text,
	`application_id` text,
	`subject` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`last_message_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `conversations_company_idx` ON `conversations` (`company_id`);--> statement-breakpoint
CREATE INDEX `conversations_candidate_idx` ON `conversations` (`candidate_id`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`doc_type` text NOT NULL,
	`file_name` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text,
	`reviewed_by_user_id` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `documents_owner_idx` ON `documents` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE INDEX `documents_status_idx` ON `documents` (`status`);--> statement-breakpoint
CREATE TABLE `educations` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`level` text NOT NULL,
	`degree` text NOT NULL,
	`field_of_study` text,
	`institution` text NOT NULL,
	`start_year` integer,
	`end_year` integer,
	`grade` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `experiences` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`company` text NOT NULL,
	`title` text NOT NULL,
	`location` text,
	`start_date` text NOT NULL,
	`end_date` text,
	`is_current` integer DEFAULT false NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `find_jobs_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`desired_role` text NOT NULL,
	`preferred_locations` text DEFAULT '[]' NOT NULL,
	`expected_ctc` real,
	`experience_years` real,
	`preferred_industry` text,
	`work_mode` text DEFAULT 'any' NOT NULL,
	`joining_availability_days` integer,
	`apply_mode` text DEFAULT 'ask_first' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`last_matched_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `find_jobs_requests_candidate_id_unique` ON `find_jobs_requests` (`candidate_id`);--> statement-breakpoint
CREATE TABLE `interview_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`interview_id` text NOT NULL,
	`author_user_id` text NOT NULL,
	`technical` integer NOT NULL,
	`communication` integer NOT NULL,
	`role_fit` integer NOT NULL,
	`experience` integer NOT NULL,
	`salary_notes` text,
	`availability_notes` text,
	`strengths` text,
	`concerns` text,
	`recommendation` text NOT NULL,
	`ai_summary` text,
	`ai_summary_source` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`interview_id`) REFERENCES `interviews`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `interviews` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`stage` text NOT NULL,
	`title` text NOT NULL,
	`scheduled_at` integer NOT NULL,
	`duration_minutes` integer DEFAULT 45 NOT NULL,
	`mode` text NOT NULL,
	`meeting_url` text,
	`location` text,
	`interviewer_user_id` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`notes` text,
	`reschedule_count` integer DEFAULT 0 NOT NULL,
	`reminder_sent_at` integer,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `interviews_application_idx` ON `interviews` (`application_id`);--> statement-breakpoint
CREATE INDEX `interviews_scheduled_idx` ON `interviews` (`scheduled_at`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`company_id` text NOT NULL,
	`placement_id` text,
	`service_request_id` text,
	`kind` text NOT NULL,
	`description` text NOT NULL,
	`amount` integer NOT NULL,
	`tax_amount` integer NOT NULL,
	`total` integer NOT NULL,
	`status` text DEFAULT 'issued' NOT NULL,
	`issued_at` integer NOT NULL,
	`due_at` integer NOT NULL,
	`paid_at` integer,
	`period_start` integer,
	`period_end` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_number_unique` ON `invoices` (`number`);--> statement-breakpoint
CREATE INDEX `invoices_company_idx` ON `invoices` (`company_id`);--> statement-breakpoint
CREATE INDEX `invoices_status_idx` ON `invoices` (`status`);--> statement-breakpoint
CREATE TABLE `job_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`reporter_user_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'open' NOT NULL,
	`resolved_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`posted_by_user_id` text NOT NULL,
	`title` text NOT NULL,
	`department` text,
	`industry` text NOT NULL,
	`location` text NOT NULL,
	`work_mode` text NOT NULL,
	`employment_type` text NOT NULL,
	`min_experience` real DEFAULT 0 NOT NULL,
	`max_experience` real,
	`education_level` text DEFAULT 'any' NOT NULL,
	`required_skills` text DEFAULT '[]' NOT NULL,
	`preferred_skills` text DEFAULT '[]' NOT NULL,
	`description` text NOT NULL,
	`responsibilities` text,
	`min_ctc` real,
	`max_ctc` real,
	`incentives` text,
	`benefits` text,
	`vacancies` integer DEFAULT 1 NOT NULL,
	`joining_within_days` integer,
	`max_notice_period_days` integer,
	`interview_process` text,
	`interview_requirements` text,
	`mandatory` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`moderation_note` text,
	`priority_until` integer,
	`view_count` integer DEFAULT 0 NOT NULL,
	`published_at` integer,
	`closed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `jobs_company_idx` ON `jobs` (`company_id`);--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`);--> statement-breakpoint
CREATE TABLE `mail_relay_log` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text,
	`direction` text NOT NULL,
	`masked_from` text NOT NULL,
	`masked_to` text NOT NULL,
	`real_recipient` text,
	`subject` text,
	`status` text NOT NULL,
	`error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_role` text NOT NULL,
	`sender_user_id` text,
	`from_address` text NOT NULL,
	`to_address` text NOT NULL,
	`body` text NOT NULL,
	`original_body` text,
	`flagged` integer DEFAULT false NOT NULL,
	`flag_reasons` text DEFAULT '[]' NOT NULL,
	`moderation_status` text DEFAULT 'none' NOT NULL,
	`channel` text DEFAULT 'in_app' NOT NULL,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_conversation_idx` ON `messages` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `messages_flagged_idx` ON `messages` (`flagged`);--> statement-breakpoint
CREATE TABLE `notification_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`notification_id` text NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`destination` text,
	`status` text NOT NULL,
	`provider` text NOT NULL,
	`error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`link` text,
	`read_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`reference` text,
	`recorded_by_user_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `placements` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`company_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`job_id` text NOT NULL,
	`plan_code` text NOT NULL,
	`selected_at` integer NOT NULL,
	`offered_ctc` real,
	`expected_joining_date` integer,
	`joining_date` integer,
	`guarantee_days` integer DEFAULT 60 NOT NULL,
	`replacement_days` integer DEFAULT 90 NOT NULL,
	`milestone_date` integer,
	`status` text DEFAULT 'pending_joining' NOT NULL,
	`left_at` integer,
	`left_reason` text,
	`replacement_status` text DEFAULT 'none' NOT NULL,
	`fee_amount` integer,
	`invoice_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `placements_application_id_unique` ON `placements` (`application_id`);--> statement-breakpoint
CREATE INDEX `placements_company_idx` ON `placements` (`company_id`);--> statement-breakpoint
CREATE INDEX `placements_status_idx` ON `placements` (`status`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`url` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`topic` text NOT NULL,
	`text` text NOT NULL,
	`options` text NOT NULL,
	`correct_index` integer NOT NULL,
	`explanation` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `questions_assessment_idx` ON `questions` (`assessment_id`);--> statement-breakpoint
CREATE TABLE `recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`job_id` text NOT NULL,
	`source` text NOT NULL,
	`score` integer NOT NULL,
	`reasons` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`message` text,
	`created_by_user_id` text,
	`responded_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recommendations_unique` ON `recommendations` (`candidate_id`,`job_id`);--> statement-breakpoint
CREATE INDEX `recommendations_candidate_idx` ON `recommendations` (`candidate_id`);--> statement-breakpoint
CREATE TABLE `resumes` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`title` text NOT NULL,
	`template` text DEFAULT 'classic' NOT NULL,
	`target_role` text,
	`headline` text,
	`summary` text,
	`skills` text DEFAULT '[]' NOT NULL,
	`sections` text DEFAULT '["summary","skills","experience","education","certifications","projects","languages"]' NOT NULL,
	`target_job_id` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `saved_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`job_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_jobs_unique` ON `saved_jobs` (`candidate_id`,`job_id`);--> statement-breakpoint
CREATE TABLE `service_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`service_code` text NOT NULL,
	`job_id` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`notes` text,
	`status` text DEFAULT 'requested' NOT NULL,
	`invoice_id` text,
	`requested_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`violation_count` integer DEFAULT 0 NOT NULL,
	`notify_email` integer DEFAULT true NOT NULL,
	`notify_sms` integer DEFAULT false NOT NULL,
	`notify_whatsapp` integer DEFAULT false NOT NULL,
	`last_login_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);