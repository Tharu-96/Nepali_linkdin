# Rozgar Platform Change Summary

This document records the main changes completed during the current implementation and manual-testing cycle. Payment credentials and other secrets are intentionally not stored here.

## Accounts and profiles

- Registration requires a role selection and all visible registration fields.
- National ID Card was added for workers and employers.
- National ID Card is available in the user profile and in relevant admin user, worker, and employer views.

## Portal navigation and layout

- Worker and employer portal pages use the shared sidebar and top navigation actions (profile, notifications, logout).
- Employer dashboard header text was simplified.
- Sidebar active-state handling supports query-string pages such as job applications.
- A **Payments** sidebar item was added for workers and employers and opens `/payment/history`.
- The Chatbot route was moved into the Admin layout at `/admin/chatbot`; `/chatbot` redirects to it.

## Jobs and applications

- Jobs accept applications only while their status is `open`.
- When an employer accepts one worker, the job moves to `in_progress`.
- Other pending applications are rejected and their workers receive a “Job no longer available” notification.
- Completing work is a job-level employer action. It updates the selected application and job to `completed` before payment can start.
- The Review page provides a **Mark Work Completed** action when an older job has a completed application but an incomplete job status.
- Application snapshots now store the applicant’s submitted full name, professional headline, skills, and proposal pitch.
- The employer’s read-only application view displays the submitted values; older applications fall back to the worker profile where available.

## Reviews

- Reviews are one-way: an employer reviews the selected worker after work completion.
- Employer and worker review pages were adjusted for responsive modal and rating-card layouts.
- Review-page Applicant action controls remain on one line and the Applicants table has centered, spaced content.

## Notifications and chat

- Platform notifications are persisted and displayed through the notification bell/dropdown.
- Application, acceptance, job-unavailable, work-completed, payment, and chat-related notification flows were aligned across employer and worker portals.
- The unused Call User controls were removed without changing chat behavior.

## Payments

- eSewa and Khalti sandbox checkout initiation and verification flows are implemented.
- Payment is available only after a job is marked `completed`.
- A successful payment creates a transaction, sends payment notifications, marks the job paid, and credits the worker’s internal Rozgar sandbox wallet.
- The worker wallet is an in-app demo ledger; it does not claim an external provider-side payout to the worker wallet.
- Platform commission is calculated at **8%** of the agreed job amount and is paid in addition by the employer. The worker’s sandbox credit is the full agreed job amount; checkout charges the employer the job amount plus the platform fee.
- Employers can cancel only **pending** payment attempts from Payment History.
- Admins can cancel only **pending** payment attempts from Admin Transactions.
- Successful, failed, cancelled, and disputed payments cannot be cancelled.

## Admin pages

- Worker and employer list actions (Suspend/Reactivate, Edit, Delete) are aligned in a single horizontal row.
- Admin worker list no longer displays the Join Date column.
- Admin worker and employer tables have clearer table dividers, centered Action headers, and responsive horizontal scrolling.
- Employer table centers Jobs Posted and Revenue values; worker table centers Applications values.
- Admin Transactions includes pending-payment cancellation and status-aware summary cards:
  - Completed Amount
  - Platform Commission
  - Net Paid to Workers
  - Pending Amount
  - Cancelled Amount
- Only successful transactions contribute to completed amount, commission, and worker payout totals.

## Manual-test status

- A completed employer-to-worker sandbox payment and worker notification were manually confirmed.
- Recommended final checks: verify the worker Payment History/wallet credit and the corresponding Admin Transactions status; optionally verify pending-payment cancellation from both employer and admin views.

## Restart note

Restart the backend after pulling these changes. On startup, the compatibility routine adds the application snapshot columns required for newly submitted applications.
