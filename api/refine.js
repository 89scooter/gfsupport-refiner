import OpenAI from "openai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "5mb"
    }
  },
  maxDuration: 60
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function cleanAiHtml(content) {
  return (content || "")
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function sanitizeHtml(html) {
  if (!html) return "";

  let imageCounter = 1;

  return html
    .replace(
      /<img[^>]*src="data:image\/[^"]+"[^>]*>/gi,
      () => `[[GOFREIGHT_IMAGE_${imageCounter++}]]`
    )
    .replace(/\s{3,}/g, " ")
    .trim();
}

function getModeInstruction(mode) {
  const map = {
    strict: `
LIMITED PROOFREAD MODE:
- Preserve the original article structure, wording, intent, and flow as much as possible.
- Focus only on grammar, spelling, punctuation, formatting, tone, wording, and readability.
- Do not heavily rewrite the article.
- Do not restructure, merge, split, or reorder sections.
- Do not significantly change headings unless they contain grammar issues or are clearly unclear.
- Do not add new sections unless the current content is clearly broken or incomplete.
- Do not remove content unless it is duplicated, clearly incorrect, or unreadable.
- Keep the output close to the original article.
- Prioritize preserving the author's original writing style.
`,

    balanced: `
BALANCED REFINEMENT MODE:
- Improve the article based on the GoFreight Knowledge Base Writing Guideline while generally preserving the original article scope and structure.
- Improve clarity, readability, tone, formatting, and customer understanding.
- Moderate rewriting is allowed when it improves readability or troubleshooting clarity.
- You may improve headings to make them more customer-friendly and searchable.
- You may add a simple overview if missing.
- You may clarify expected system behavior when helpful.
- You may improve troubleshooting instructions to make them easier to follow.
- You may improve FAQ wording when answers are too short or unclear.
- Keep the article operationally clear and suitable for AI-powered retrieval.
- Do not remove important business, operational, or technical information.
`,

    creative: `
STRONG KB REFINEMENT MODE:
- Strictly follow the GoFreight Knowledge Base Writing Guideline.
- Do not simply proofread.
- Your responsibility is to strongly improve the article while preserving the original article scope and purpose.

Primary goals:
- Improve customer readability.
- Improve operational clarity.
- Improve troubleshooting quality.
- Improve FAQ usefulness.
- Improve AI retrieval quality.
- Improve formatting and article structure.
- Reduce vague or confusing wording.

You should:
- Restructure sections when necessary for readability.
- Rewrite vague headings into clearer and more searchable headings.
- Improve wording to make instructions operationally clear.
- Improve troubleshooting clarity and actionability.
- Rewrite weak FAQ answers into meaningful operational answers.
- Add expected system behavior explanations when applicable.
- Add permission scope or system limitation explanations when applicable.
- Improve formatting using headings, bullets, numbering, or tables when helpful.
- Convert large paragraphs into clearer step-by-step instructions when appropriate.
- Remove repetitive, confusing, or low-value wording.
- Prioritize customer readability over preserving weak wording.

FAQ rules:
- Never leave FAQ answers as only "Yes" or "No."
- FAQ answers should include useful operational guidance, conditions, limitations, or next steps whenever possible.
- If the source content does not provide enough detail, provide the safest helpful explanation without inventing unsupported product behavior.

Screenshot rules:
- Do not attempt to analyze or modify screenshots.
- Screenshot quality, annotations, arrows, highlighting, cropping, and visual clarity are responsibilities of the article writer or reviewer.
- If screenshots are referenced in the article, improve the surrounding explanation text so customers can better understand what to focus on.

Title rules:
- Preserve the original article scope.
- Do not split the article into multiple articles.
- Do not rewrite the article into a different operational topic.
- However, improve title readability and searchability when appropriate.
- Avoid special symbols in titles whenever possible.

Avoid these symbols in titles:
% # ? & + = / \\ : ; ' " ( ) , @ ! *

Hard rules:
- Never keep vague section headings such as "Setup", "Issue", or "FAQ" if clearer wording can be used.
- Never keep large unstructured paragraphs if the content can be organized more clearly.
- Prioritize searchable and AI-friendly wording over generic wording.
- Do not invent product behavior, policy, limitations, or troubleshooting steps that are not supported by the source content.

The output should feel like:
- a professionally refined SaaS Knowledge Base article
- not a lightly proofread draft
- not a grammar cleanup
- not a generic AI-generated article
`
  };

  return map[mode] || map.balanced;
}

function getTemperature(mode) {
  if (mode === "strict") return 0.1;
  if (mode === "creative") return 0.3;
  return 0.25;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      guideline,
      sectionHtml,
      model = "gpt-4o-mini",
      mode = "balanced",
      sectionIndex = 1,
      totalSections = 1
    } = req.body || {};

    if (!guideline || !sectionHtml) {
      return res.status(400).json({
        error: "Missing guideline or sectionHtml."
      });
    }

    const cleanedSectionHtml = sanitizeHtml(sectionHtml);

    const systemPrompt = `
You are a professional editor for GoFreight Support documentation.

Your task is to refine one section of a document according to the provided GoFreight Knowledge Base Writing Guideline and the selected refinement mode.

Core rules:
1. Return valid HTML only.
2. Do not wrap the response in markdown code fences.
3. Preserve tables, bullets, numbering, headings, links, and formatting where possible unless the selected refinement mode allows restructuring.
4. Keep image placeholders exactly as written, such as [[GOFREIGHT_IMAGE_1]].
5. Do not remove important technical, operational, or business information.
6. Do not invent product behavior, policy, steps, system limitations, timelines, or troubleshooting details.
7. This is section ${sectionIndex} of ${totalSections}. Refine only this section.
8. Do not add artificial section labels unless they already exist or the selected refinement mode requires clearer structure.
9. Keep the output suitable for GoFreight customer-facing or internal support documentation.
10. Prioritize customer readability, operational clarity, searchability, and AI-friendly structure.
11. If screenshots are referenced, improve the surrounding explanation text, but do not attempt to review image quality itself.
12. Preserve the original article scope and operational topic.
13. FAQ answers should contain meaningful operational guidance instead of only "Yes" or "No".
14. Prefer operationally searchable wording over generic wording.
15. Avoid unnecessary special symbols in titles whenever possible.

SELECTED REFINEMENT MODE:
${getModeInstruction(mode)}
`;

    const userPrompt = `
=== GOFREIGHT KNOWLEDGE BASE WRITING GUIDELINE ===
${guideline}

=== DOCUMENT SECTION ${sectionIndex} OF ${totalSections} ===
${cleanedSectionHtml}
`;

    const completion = await client.chat.completions.create({
      model,
      temperature: getTemperature(mode),
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ]
    });

    const html = cleanAiHtml(
      completion.choices?.[0]?.message?.content || ""
    );

    return res.status(200).json({
      html,
      sectionIndex,
      totalSections
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error?.message || "Unexpected server error."
    });
  }
}
