# PHASE 0 — PRODUCT DISCOVERY & SYSTEM DESIGN

We are starting Phase 0 of the Biomedical Waste Billing & Collection Management System.

Do NOT write production code yet.

Your task is to act as a Product Manager, Business Analyst, Solution Architect, Database Architect, and Senior Software Engineer.

Based on the project master context:

1. Analyze the complete business workflow.
2. Identify missing business requirements.
3. Identify assumptions that need validation.
4. Create a detailed user-role matrix.
5. Define the core entities and relationships.
6. Propose a database ER model.
7. Define the invoice lifecycle.
8. Define the payment lifecycle.
9. Define the follow-up lifecycle.
10. Define the reminder lifecycle.
11. Identify important edge cases.

Pay special attention to:

* Partial payments
* Multiple payments against invoices
* Payment reversals
* Invoice cancellation
* Customer disputes
* Credit notes
* Overpayments
* Multiple invoices per customer
* Promise-to-pay tracking
* Follow-up assignment
* Reminder failures
* Duplicate reminders
* GST/tax handling
* Financial auditability

Then produce the following documents:

1. BUSINESS_REQUIREMENTS.md
2. USER_ROLES.md
3. BUSINESS_WORKFLOW.md
4. DATABASE_DESIGN.md
5. API_ARCHITECTURE.md
6. EDGE_CASES.md
7. DEVELOPMENT_ROADMAP.md

Do not implement application code.

Do not invent complicated features unless they solve a real business problem.

Ask questions where business rules cannot safely be assumed.

The goal of Phase 0 is to remove ambiguity before implementation.
