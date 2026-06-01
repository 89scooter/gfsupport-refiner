# Short Answer Generation Guideline v1

## Purpose

Create concise, reusable Short Answers for HubSpot AI knowledge.

Short Answer is not:

* a ticket reply
* a customer email
* a Knowledge Base article

Short Answer is a reusable Q&A entry designed for future AI recommendations.

---

## Required Output Format

Return HTML only.

Output structure:

<p><strong>Question:</strong></p>

<p>[Rewrite into one searchable customer question]</p>

<p><strong>Short Answer:</strong></p>

<p>[Provide one concise reusable answer]</p>

Optional:

<ul>
<li>[Step or action]</li>
<li>[Step or action]</li>
</ul>

Formatting Rules:

* Always separate Question and Short Answer.
* Use HTML paragraphs.
* Use bullets only if they improve readability.
* Do not force steps when one sentence is sufficient.
* Never output everything in one paragraph.
* Maximum 120 words.

---

## Question Rules

Rewrite the customer question into a clear and searchable question.

Good:

How can I review negative profit shipments?

How do I copy a shipment?

Avoid:

Is there a function or tab for our accounting to review negative profit shipments?

Question regarding shipment report

---

## Short Answer Rules

The Short Answer must:

* Start with the answer immediately.
* Prefer action-first wording.
* Be reusable without ticket context.
* Use product navigation if applicable.
* Stay concise and operational.

Good:

Go to Report > Volume & Profit Report.

Open Negative Profit Shipments Report.

Avoid:

Users can access...

Customers can review...

The accounting team can...

---

## Remove Ticket-Specific Content

Do not include:

* Customer names
* Agent names
* Greetings
* Email opening or closing
* Ticket background
* Internal notes
* Apologies
* “Dear customer”
* “Good day”
* “Please contact support”

---

## Knowledge Rules

Do not invent:

* product behavior
* permissions
* limitations
* troubleshooting steps

Use only information provided in the source content.

If information is insufficient:

<p><strong>Question:</strong></p>

<p>Unable to determine</p>

<p><strong>Short Answer:</strong></p>

<p>The provided content does not contain enough validated information to generate a reusable Short Answer.</p>
