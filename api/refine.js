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

function getModeInstruction(mode) {
  const map = {
    strict: `
LIMITED PROOFREAD MODE:
- Preserve the original article structure, intent, wording, and flow as much as possible.
- Focus only on grammar, spelling, punctuation, formatting, tone, wording, and readability.
- Do not heavily rewrite the article.
- Do not restructure, merge, split, or reorder sections.
- Do not change headings unless they contain grammar issues or are clearly unclear.
- Do not add new sections unless the current content is clearly broken or incomplete.
- Do not remove content unless it is duplicated, clearly incorrect, or unreadable.
- Keep the output close to the original article.
`,

    balanced: `
BALANCED REFINEMENT MODE:
- Improve the article based on the GoFreight Knowledge Base Writing Guideline while generally preserving the original article scope.
- Improve clarity, readability, tone, structure, headings, and formatting when helpful.
- Moderate rewriting is allowed when it improves customer understanding.
- You may add a simple overview if the article does not clearly explain its purpose.
- You may clarify expected system behavior when the original article is vague.
- You may improve troubleshooting steps so they are easier for customers to follow.
- You may rewrite vague headings into clearer and more searchable headings.
- If the article combines unrelated topics, you may suggest clearer separation within the article, but do not aggressively split unless necessary.
- Do not remove important business, operational, or technical information.
- Keep the article customer-friendly, operationally clear, and easy for AI-powered support tools to retrieve.
`,

    creative: `
GUIDELINE STRICT REWRITE MODE:
- Strictly follow the GoFreight Knowledge Base Writing Guideline.
- Do not simply proofread.
- Actively transform the article into a customer-friendly, operationally clear, and AI-friendly Knowledge Base article.

You should:
- Restructure the article when necessary.
- Rewrite vague headings into searchable and customer-friendly headings.
- Split unrelated topics into separate sections or clearly suggest separate article topics when needed.
- Replace generic wording with operationally clear instructions.
- Improve troubleshooting clarity and actionability.
- Rewrite poor FAQ answers into complete and meaningful answers.
- Add a simple overview if missing.
- Add system limitation, permission scope, or expected behavior explanations when applicable.
- Improve screenshot guidance based on the guideline.
- Remove unnecessary, repetitive, confusing, or low-value content.
- Use step-by-step instructions when they make the workflow easier to follow.
- Prioritize customer readability over preserving the original structure.

Hard rules:
- Never keep titles that combine unrelated workflows if a clearer focused title is possible.
- Never leave FAQ answers as only "Yes" or "No."
- Never keep vague section headings such as "Setup", "Tracking", "Invoice", or "Issue" if a more specific heading can be used.
- If the original article structure is poor, prioritize restructuring over preserving the original format.
- Do not invent product behavior, policy, system limitations, or troubleshooting steps that are not supported by the source content.
`
  };

  return map[mode] || map.balanced;
}

function getTemperature(mode) {
  if (mode === "strict") return 0.1;
  if (mode === "creative") return 0.35;
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
11. If the article mentions screenshots or images, improve the surrounding text guidance, but do not attempt to analyze or modify the actual image.
12. If the input is too broad or combines unrelated topics, handle it according to the selected refinement mode.

SELECTED REFINEMENT MODE:
${getModeInstruction(mode)}
`;

    const userPrompt = `
=== GOFREIGHT KNOWLEDGE BASE WRITING GUIDELINE ===
${guideline}

=== DOCUMENT SECTION ${sectionIndex} OF ${totalSections} ===
${sectionHtml}
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

    const html = cleanAiHtml(completion.choices?.[0]?.message?.content || "");

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
