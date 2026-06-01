const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

const config = {
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

function loadGuideline(contentType = "article") {
  const fileName =
    contentType === "short-answer"
      ? "short-answer.md"
      : "article.md";

  const filePath = path.join(
    process.cwd(),
    "public/guidelines",
    fileName
  );

  if (!fs.existsSync(filePath)) {
    throw new Error("Guideline file not found: " + filePath);
  }

  return fs.readFileSync(filePath, "utf-8");
}

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
- Preserve the original structure, wording, intent, and flow as much as possible.
- Focus only on grammar, spelling, punctuation, formatting, tone, wording, and readability.
- Do not heavily rewrite.
`,

    balanced: `
BALANCED REFINEMENT MODE:
- Improve clarity, readability, tone, formatting, and customer understanding.
- Moderate rewriting is allowed when it improves readability.
- Keep the original scope.
- Do not remove important business, operational, or technical information.
`,

    creative: `
STRONG REFINEMENT MODE:
- Strongly improve structure, clarity, formatting, troubleshooting quality, and AI retrieval quality.
- Rewrite vague headings into clearer and more searchable headings.
- Convert large paragraphs into clearer step-by-step instructions when appropriate.
- Keep the tone concise, direct, operational, and support-friendly.
- Do not invent product behavior, policy, limitations, or troubleshooting steps.
`
  };

  return map[mode] || map.balanced;
}

function getTemperature(mode) {
  if (mode === "strict") return 0.1;
  if (mode === "creative") return 0.28;
  return 0.22;
}

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      contentType = "article",
      sectionHtml,
      model = "gpt-4o-mini",
      mode = "balanced",
      sectionIndex = 1,
      totalSections = 1
    } = req.body || {};

    if (!sectionHtml) {
      return res.status(400).json({
        error: "Missing sectionHtml."
      });
    }

    const guideline = loadGuideline(contentType);
    const cleanedSectionHtml = sanitizeHtml(sectionHtml);

    const systemPrompt = `
You are a professional editor for GoFreight Support documentation.

Your task is to refine one section according to the selected refinement profile and guideline.

Core rules:
1. Return valid HTML only.
2. Do not wrap the response in markdown code fences.
3. Preserve tables, bullets, numbering, headings, links, and formatting where possible.
4. Keep image placeholders exactly as written, such as [[GOFREIGHT_IMAGE_1]].
5. Do not remove important technical, operational, or business information.
6. Do not invent product behavior, policy, steps, limitations, timelines, or troubleshooting details.
7. This is section ${sectionIndex} of ${totalSections}. Refine only this section.
8. Keep the output suitable for GoFreight customer-facing or internal support documentation.
9. Prioritize readability, operational clarity, searchability, and AI-friendly structure.

SELECTED REFINEMENT MODE:
${getModeInstruction(mode)}
`;

    const userPrompt = `
=== SELECTED GUIDELINE ===
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

module.exports = handler;
module.exports.config = config;
