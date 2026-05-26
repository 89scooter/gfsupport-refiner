import OpenAI from "openai";
import formidable from "formidable";
import mammoth from "mammoth";
import fs from "fs/promises";

export const config = {
  api: {
    bodyParser: false
  },
  maxDuration: 300
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function getField(fields, key, defaultValue = "") {
  const value = fields[key];
  if (Array.isArray(value)) return value[0];
  return value || defaultValue;
}

function protectImages(html) {
  const images = [];

  const htmlWithoutImages = html.replace(/<img[^>]*>/gi, (match) => {
    const placeholder = `[[GOFREIGHT_IMAGE_${images.length + 1}]]`;
    images.push({
      placeholder,
      original: match
    });
    return placeholder;
  });

  return {
    htmlWithoutImages,
    images
  };
}

function restoreImages(html, images) {
  let restored = html;

  for (const image of images) {
    restored = restored.replaceAll(image.placeholder, image.original);
  }

  return restored;
}

async function readFileContent(file) {
  if (!file) return "";

  const filepath = file.filepath || file.path;
  const buffer = await fs.readFile(filepath);
  const filename = file.originalFilename || "";

  if (filename.endsWith(".html") || filename.endsWith(".htm")) {
    return buffer.toString("utf8");
  }

  if (filename.endsWith(".txt")) {
    return buffer.toString("utf8");
  }

  if (filename.endsWith(".docx")) {
    const result = await mammoth.convertToHtml({ buffer });
    return result.value;
  }

  return buffer.toString("utf8");
}

function cleanAiHtml(content) {
  return (content || "")
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function splitHtmlIntoChunks(html, maxChars = 9000) {
  const blocks = html
    .replace(/<\/(p|li|h1|h2|h3|h4|tr|table|ul|ol|div)>/gi, "</$1>\n")
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks = [];
  let current = "";

  for (const block of blocks) {
    if ((current + "\n" + block).length > maxChars && current.length > 0) {
      chunks.push(current);
      current = block;
    } else {
      current += (current ? "\n" : "") + block;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  if (chunks.length === 0 && html.trim()) {
    chunks.push(html.trim());
  }

  return chunks;
}

function getModeInstruction(mode) {
  const modeInstructionMap = {
    strict: `
LIGHT PROOFREAD MODE:
- Preserve the original author's writing style, wording, structure, and flow as much as possible.
- Only fix typos, grammar, punctuation, formatting issues, unclear sentences, and minor paragraph flow.
- Do not heavily rewrite.
- Do not restructure sections unless the current structure is clearly broken.
- Do not remove content unless it is duplicated or clearly incorrect.
- The goal is light editing, not rewriting.
`,
    balanced: `
BALANCED MODE:
- Improve clarity, readability, tone, and structure based on the guideline.
- Keep the original meaning and most of the original structure.
- Moderate rewriting is allowed when it improves reader understanding.
- You may reorganize small sections, improve headings, and simplify long sentences.
- Do not remove important business or operational information.
- The goal is a practical middle ground between preserving the original and improving the reader experience.
`,
    creative: `
MORE REWRITE MODE:
- Follow the guideline aggressively.
- Prioritize the reader's understanding, clarity, and usefulness over preserving the original wording.
- You may rewrite, restructure, merge, split, or reorder sections when needed.
- You may remove redundant, confusing, or low-value content.
- You may improve headings, steps, examples, and flow significantly.
- Keep all important business, operational, and technical information accurate.
- The goal is to produce the best possible article for the reader, even if it requires major rewriting.
`
  };

  return modeInstructionMap[mode] || modeInstructionMap.balanced;
}

function getTemperature(mode) {
  if (mode === "strict") return 0.1;
  if (mode === "creative") return 0.6;
  return 0.3;
}

async function refineChunk({
  model,
  mode,
  guideline,
  chunk,
  index,
  total
}) {
  const systemPrompt = `
You are a professional editor for GoFreight Support documentation.

Your job is to refine and proofread the provided document section according to the guideline.

Rules:
1. Keep the final output in valid HTML format.
2. Preserve tables, bullets, numbering, links, headings, and image placeholders where possible.
3. Do NOT remove important business, operational, or technical information.
4. Keep every image placeholder exactly as written, such as [[GOFREIGHT_IMAGE_1]].
5. Do not add explanations outside the HTML.
6. Do not wrap the output in markdown code fences.
7. This is section ${index} of ${total}. Refine only this section.
8. Do not add artificial section labels like "Section ${index}" unless they already exist in the content.

PROCESS OPTION:
${getModeInstruction(mode)}
`;

  const userPrompt = `
=== GUIDELINE ===
${guideline}

=== DOCUMENT SECTION ${index} OF ${total} ===
${chunk}

=== MODE ===
${mode}
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

  return cleanAiHtml(completion.choices?.[0]?.message?.content || "");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const form = formidable({
      multiples: false
    });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            fields,
            files
          });
        }
      });
    });

    const guidelineFile = Array.isArray(files.guideline)
      ? files.guideline[0]
      : files.guideline;

    const documentFile = Array.isArray(files.document)
      ? files.document[0]
      : files.document;

    const model = getField(fields, "model", "gpt-4o-mini");
    const mode = getField(fields, "mode", "balanced");

    const guideline = await readFileContent(guidelineFile);
    const documentHtml = await readFileContent(documentFile);

    const protectedResult = protectImages(documentHtml);
    const htmlWithoutImages = protectedResult.htmlWithoutImages;
    const images = protectedResult.images;

    const safeHtml = htmlWithoutImages.replace(
      /data:image\/[^;]+;base64,[^"]+/gi,
      "[BASE64_IMAGE_REMOVED_FOR_STABILITY]"
    );

    const chunks = splitHtmlIntoChunks(safeHtml, 9000);

    const refinedChunks = [];

    for (let i = 0; i < chunks.length; i++) {
      const refinedChunk = await refineChunk({
        model,
        mode,
        guideline,
        chunk: chunks[i],
        index: i + 1,
        total: chunks.length
      });

      refinedChunks.push(refinedChunk);
    }

    let refined = refinedChunks.join("\n\n");
    refined = restoreImages(refined, images);

    return res.status(200).json({
      html: refined,
      imagesPreserved: images.length,
      sectionsProcessed: chunks.length,
      refineType: "long-document"
    });
  } catch (err) {
    console.error(err);

    const message = err?.message || "Unexpected server error";

    return res.status(500).json({
      error: message,
      timeoutHint:
        "The document may be too large or image-heavy. Try reducing image size or splitting the article into smaller parts."
    });
  }
}
