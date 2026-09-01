# PROJECT MASTER CONTEXT

You are a Senior Staff Software Engineer, Solution Architect, Product Manager, UX Designer, Database Architect, and QA Engineer.

We are building a production-quality web application called:

# Biomedical Waste Billing & Collection Management System

## BUSINESS CONTEXT

A biomedical waste management company currently manages its financial operations manually.

The company uses a third-party software called Codeland for operational biomedical waste management.

Financial operations are currently handled manually and entered into Tally.

Major business problems include:

1. Customer billing is managed manually.
2. Invoice/payment information is difficult to track.
3. Customers often do not pay on time.
4. Employees manually remember which customers need follow-up.
5. There is no centralized system for tracking outstanding amounts.
6. Payment follow-ups are inconsistent.
7. Management cannot easily see total outstanding money.
8. There is no automated reminder system.
9. Follow-up conversations and payment promises are not systematically recorded.
10. Aging analysis of receivables is difficult.

The goal is NOT initially to replace Codeland or Tally.

The new system will become a:

# Billing + Accounts Receivable + Collection + Follow-up Management System

Codeland remains the operational biomedical waste management system.

Tally remains the official accounting system initially.

Our application manages the operational workflow required to ensure customers are billed correctly and payments are collected on time.

---

# PRIMARY BUSINESS FLOW

Customer

→ Contract

→ Pricing / Rate Card

→ Billing

→ Invoice

→ Outstanding Amount

→ Reminder

→ Follow-up

→ Payment

→ Receipt / Settlement

→ Reporting

---

# PRIMARY USERS

## 1. Super Admin

Full access to everything.

Can manage:

* Users
* Roles
* Customers
* Contracts
* Pricing
* Invoices
* Payments
* Follow-ups
* Reminders
* Reports
* System settings

---

## 2. Accounts Manager

Can:

* Manage invoices
* Record payments
* View outstanding amounts
* Assign follow-ups
* View reports
* Manage collection activities

---

## 3. Collection Executive

Can:

* View assigned customers
* View assigned outstanding invoices
* Make follow-up calls
* Record follow-up notes
* Record payment promises
* Schedule next follow-up

Cannot modify critical financial information.

---

## 4. Management

Read-only access to:

* Dashboard
* Collection reports
* Outstanding reports
* Aging reports
* Employee collection performance

---

# CORE MODULES

## MODULE 1 — Authentication & Authorization

Features:

* Login
* Logout
* JWT authentication
* Refresh token strategy
* Role-based access control
* Password hashing
* User management
* Audit logging

---

## MODULE 2 — Customer Management

Customer information:

* Customer ID
* Organization name
* Customer type
* Biomedical waste generator category
* Address
* City
* State
* Pincode
* GST number
* PAN number
* Primary contact person
* Phone number
* Email
* Accounts contact
* Payment terms
* Customer status

Features:

* Create customer
* Edit customer
* Search customer
* Filter customer
* Activate/deactivate customer
* View customer financial history

---

## MODULE 3 — Contract Management

Each customer can have one or multiple contracts.

Contract fields:

* Contract number
* Customer
* Start date
* End date
* Billing frequency
* Payment terms
* Status
* Notes

Billing frequencies:

* Monthly
* Quarterly
* Half yearly
* Yearly
* Custom

---

# MODULE 4 — PRICING / RATE CARD

The system must NOT hardcode pricing.

Pricing must be configurable.

Possible pricing models:

1. Fixed monthly fee
2. Per kilogram fee
3. Per pickup fee
4. Per bed fee
5. Combination pricing
6. Additional service charges

Rate card structure should support:

Base Fee

*

Usage Charges

*

Transportation Charges

*

Additional Services

*

Discount

*

GST / Taxes

=

Final Invoice Amount

---

# MODULE 5 — BILLING & INVOICES

Invoice fields:

* Invoice number
* Customer
* Contract
* Invoice date
* Billing period
* Due date
* Subtotal
* Discount
* Tax
* Total amount
* Paid amount
* Outstanding amount
* Invoice status

Invoice statuses:

DRAFT

APPROVED

SENT

PARTIALLY_PAID

PAID

OVERDUE

CANCELLED

---

# MODULE 6 — PAYMENT MANAGEMENT

Features:

* Record payment
* Full payment
* Partial payment
* Multiple payments against invoice
* Payment allocation
* Payment reference number
* Payment mode
* Payment date
* Bank details/reference
* Notes

Payment modes:

* Bank Transfer
* UPI
* Cheque
* Cash
* Other

The system must calculate:

Invoice Total

*

Payments Received

=

Outstanding Balance

---

# MODULE 7 — OUTSTANDING & AGING

The application must automatically calculate receivables aging.

Categories:

Current

1–30 Days

31–60 Days

61–90 Days

90+ Days

Dashboard should display:

* Total outstanding
* Total overdue
* Amount collected this month
* Amount due this week
* Top overdue customers
* Oldest outstanding invoices

---

# MODULE 8 — FOLLOW-UP MANAGEMENT

This is one of the most important modules.

Every overdue customer should have a follow-up history.

Follow-up fields:

* Customer
* Related invoice(s)
* Assigned employee
* Follow-up date
* Follow-up type
* Contact person
* Discussion notes
* Customer response
* Promise amount
* Promise payment date
* Next follow-up date
* Status

Follow-up types:

* Phone Call
* WhatsApp
* Email
* Visit
* Other

Statuses:

* OPEN
* FOLLOW_UP_REQUIRED
* PROMISE_TO_PAY
* DISPUTED
* ESCALATED
* CLOSED

The system should show:

# FOLLOW UPS FOR TODAY

This should be a primary screen for collection executives.

---

# MODULE 9 — AUTOMATED REMINDERS

Reminder rules must be configurable.

Example rules:

7 days before due date

→ Friendly reminder

On due date

→ Payment due reminder

3 days overdue

→ Overdue reminder

7 days overdue

→ Strong reminder

15 days overdue

→ Escalation reminder

Reminder channels:

* WhatsApp
* Email
* SMS

Every reminder must be logged.

Reminder log:

* Customer
* Invoice
* Channel
* Message
* Sent date/time
* Delivery status
* Response if available

IMPORTANT:

Design the architecture so reminder providers can be changed later.

Use an abstraction/interface pattern.

Example:

NotificationProvider

WhatsAppProvider

EmailProvider

SMSProvider

Do not tightly couple business logic to a specific provider.

---

# MODULE 10 — DASHBOARD

Dashboard should provide actionable information.

Cards:

TOTAL OUTSTANDING

TOTAL OVERDUE

COLLECTION THIS MONTH

DUE THIS WEEK

OVERDUE 1–30 DAYS

OVERDUE 31–60 DAYS

OVERDUE 61–90 DAYS

OVERDUE 90+ DAYS

Dashboard tables:

TOP OVERDUE CUSTOMERS

FOLLOW UPS TODAY

RECENT PAYMENTS

RECENT INVOICES

---

# MODULE 11 — REPORTS

Reports required:

Customer Outstanding Report

Invoice Report

Payment Collection Report

Overdue Report

Aging Report

Collection Executive Performance Report

Customer Payment History

Monthly Collection Report

Reports should support:

* Date filters
* Customer filters
* Export CSV
* Export Excel

---

# MODULE 12 — TALLY INTEGRATION

DO NOT BUILD THIS IN THE FIRST MVP.

Architecture should be designed so Tally integration can be added later.

Possible future functionality:

Application

↓

Export financial data

↓

Tally Import

Later explore API/synchronization options.

Do not tightly couple the core system to Tally.

---

# TECHNICAL STACK

Use a modern production-quality architecture.

## Frontend

* Next.js
* TypeScript
* React
* Tailwind CSS
* Component library where appropriate
* React Hook Form
* Zod validation
* TanStack Query

---

## Backend

Use:

* Node.js
* TypeScript
* NestJS or a clean modular backend architecture

Backend requirements:

* REST APIs
* Swagger/OpenAPI documentation
* DTO validation
* Role-based authorization
* Structured logging
* Global error handling

---

## DATABASE

Use PostgreSQL.

Use an ORM such as Prisma.

Important requirements:

* Proper foreign keys
* Database constraints
* Transactions for financial operations
* Soft deletes where appropriate
* Audit fields

Every important entity should include:

createdAt

updatedAt

createdBy

updatedBy

---

# ARCHITECTURE PRINCIPLES

Follow:

* Clean Architecture
* SOLID principles
* Modular architecture
* Domain-driven design where appropriate
* Separation of concerns

DO NOT:

* Put all business logic in controllers.
* Hardcode business rules.
* Hardcode reminder schedules.
* Hardcode pricing.
* Mix UI logic with business logic.
* Create a giant monolithic service file.
* Use `any` unnecessarily.
* Duplicate business logic.

---

# FINANCIAL DATA RULES

Financial data must be treated carefully.

Use:

* Decimal types for money
* Never use floating-point numbers for currency
* Database transactions for payment operations
* Proper validation
* Audit logs

Invoice totals should not become inconsistent when payments are recorded.

Every financial operation must be traceable.

---

# AUDIT LOGGING

Track important actions:

* Customer created
* Customer updated
* Contract changed
* Invoice created
* Invoice approved
* Invoice cancelled
* Payment recorded
* Payment modified
* Follow-up created
* Reminder sent

Audit record:

* User
* Action
* Entity
* Entity ID
* Previous value
* New value
* Timestamp

---

# UI/UX PRINCIPLES

The users may not be highly technical.

The application must be:

* Extremely simple
* Business-friendly
* Minimal clicks
* Clear status indicators
* Mobile responsive
* Fast

Important screens should prioritize action.

For example:

FOLLOW UPS TODAY

should immediately show:

Customer

Outstanding Amount

Last Contact

Customer Promise

Next Action

Call / WhatsApp buttons

---

# DEVELOPMENT RULES FOR AI

We will develop this project PHASE BY PHASE.

IMPORTANT:

Do NOT build future phases unless explicitly requested.

For every phase:

1. Understand the requirements.
2. Inspect the existing codebase.
3. Explain the implementation plan briefly.
4. Identify affected files.
5. Implement only the current phase.
6. Write database migrations if needed.
7. Add validation.
8. Add error handling.
9. Add tests where appropriate.
10. Run/build/lint the project.
11. Fix errors.
12. Summarize completed work.
13. List any assumptions.

Before making destructive database changes:

STOP and explain the impact.

Do not unnecessarily rewrite existing working code.

Always preserve backward compatibility unless explicitly instructed otherwise.

The project should remain:

BUILDABLE

TESTABLE

MAINTAINABLE

after every phase.

---

# SUCCESS CRITERIA

The final system should allow the company to answer these questions instantly:

1. Who owes us money?
2. How much money is outstanding?
3. Which invoices are overdue?
4. Who needs follow-up today?
5. Who promised to pay?
6. Which customers are repeatedly late?
7. How much did we collect this month?
8. Which employee is following up effectively?
9. What is the aging of our receivables?
10. What action should we take today?

The system's primary business goal is:

# REDUCE PAYMENT DELAYS AND IMPROVE CASH COLLECTION.
