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
LIGHT PROOFREAD MODE:
- Preserve the original author's writing style, wording, structure, and flow as much as possible.
- Only fix typos, grammar, punctuation, formatting issues, unclear sentences, and minor paragraph flow.
- Do not heavily rewrite.
- Do not restructure sections unless the current structure is clearly broken.
- Do not remove content unless it is duplicated or clearly incorrect.
`,

    balanced: `
BALANCED MODE:
- Improve clarity, readability, tone, and structure based on the guideline.
- Keep the original meaning and most of the original structure.
- Moderate rewriting is allowed when it improves reader understanding.
- You may reorganize small sections, improve headings, and simplify long sentences.
- Do not remove important business or operational information.
`,

    creative: `
MORE REWRITE MODE:
- Follow the guideline aggressively.
- Prioritize the reader's understanding, clarity, and usefulness over preserving the original wording.
- You may rewrite, restructure, merge, split, or reorder sections when needed.
- You may remove redundant, confusing, or low-value content.
- You may improve headings, steps, examples, and flow significantly.
- Keep all important business, operational, and technical information accurate.
`
  };

  return map[mode] || map.balanced;
}

function getTemperature(mode) {
  if (mode === "strict") return 0.1;
  if (mode === "creative") return 0.5;
  return 0.3;
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

Your task is to refine one section of a document according to the provided guideline.

Rules:
1. Return valid HTML only.
2. Do not wrap the response in markdown code fences.
3. Preserve tables, bullets, numbering, headings, links, and formatting where possible.
4. Keep image placeholders exactly as written, such as [[GOFREIGHT_IMAGE_1]].
5. Do not remove important technical, operational, or business information.
6. Do not invent product behavior, policy, steps, or system details.
7. This is section ${sectionIndex} of ${totalSections}. Refine only this section.
8. Do not add artificial section labels unless they already exist.
9. Keep the output suitable for GoFreight customer-facing or internal support documentation.

PROCESS OPTION:
${getModeInstruction(mode)}
`;

    const userPrompt = `
=== GUIDELINE ===
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
