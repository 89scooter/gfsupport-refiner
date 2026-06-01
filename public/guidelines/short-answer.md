# Short Answer Generation Guideline v1

## Purpose

Create a concise, reusable Short Answer for HubSpot AI knowledge.

Short Answer is not a ticket reply.
Short Answer is not a full Knowledge Base article.
Short Answer is a reusable Q&A entry for future AI recommendations.

---

## Required Output Format

Return only the following format:

Question:
[One clear customer-style question]

Short Answer:
[One concise reusable answer]

---

## Question Rules

Rewrite the customer question into a clear, searchable question.

Good:
How can I review negative profit shipments?

Avoid:
Is there a function or tab for our accounting to review the negative profit shipments?

---

## Short Answer Rules

The Short Answer must:

- Directly answer the question in the first sentence.
- Be reusable without ticket context.
- Use product navigation if applicable.
- Be concise and operational.
- Stay between 50–150 words when possible.

---

## Remove Ticket-Specific Content

Do not include:

- Customer names
- Agent names
- Greetings
- Email-style opening or closing
- Ticket-specific background
- Internal notes
- Apologies
- “Dear customer”
- “Good day”
- “Please contact support”

---

## Knowledge Rules

Do not invent product behavior, permissions, limitations, or troubleshooting steps.

Only use information provided in the source content.

If the source content is not enough to create a reliable Short Answer, return:

Question:
Unable to determine

Short Answer:
The provided content does not contain enough validated information to create a reusable Short Answer.
