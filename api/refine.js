const fs = require('fs/promises');
const formidable = require('formidable');
const mammoth = require('mammoth');
const OpenAI = require('openai');

function parseForm(req) {
  const form = formidable({
    maxFileSize: 25 * 1024 * 1024,
    multiples: false,
    keepExtensions: true
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function getField(fields, name, fallback = '') {
  const value = fields[name];
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

function getFile(files, name) {
  const value = files[name];
  return Array.isArray(value) ? value[0] : value;
}

function stripHtml(html = '') {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function docxToHtml(buffer) {
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const base64 = await image.read('base64');
        return {
          src: `data:${image.contentType};base64,${base64}`
        };
      })
    }
  );

  return result.value.trim();
}

function txtToHtml(text) {
  return `<p>${text
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>')}</p>`;
}

async function fileToHtml(file) {
  const filename = (file.originalFilename || '').toLowerCase();
  const buffer = await fs.readFile(file.filepath);

  if (filename.endsWith('.docx')) {
    return await docxToHtml(buffer);
  }

  if (filename.endsWith('.html') || filename.endsWith('.htm')) {
    return buffer.toString('utf8').trim();
  }

  if (filename.endsWith('.txt')) {
    return txtToHtml(buffer.toString('utf8'));
  }

  throw new Error(
    'Unsupported file type. Please upload .docx, .html, .htm, or .txt files.'
  );
}

function protectImages(html) {
  const images = [];

  const htmlWithoutImages = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const key = `[[GOFREIGHT_IMAGE_${images.length + 1}]]`;

    images.push({
      key,
      tag
    });

    return key;
  });

  return {
    htmlWithoutImages,
    images
  };
}

function restoreImages(html, images) {
  let restored = html;

  for (const img of images) {
    restored = restored.split(img.key).join(img.tag);
  }

  return restored;
}

function cleanModelOutput(text = '') {
  return text
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  // Access code validation
  const expectedCode = process.env.ACCESS_CODE;
  const providedCode = req.headers['x-access-code'];

  if (expectedCode && providedCode !== expectedCode) {
    return res.status(401).json({
      error: 'Invalid access code.'
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY is missing on the server.'
    });
  }

  try {
    const { fields, files } = await parseForm(req);

    const guidelineFile = getFile(files, 'guideline');
    const documentFile = getFile(files, 'document');

    if (!guidelineFile || !documentFile) {
      return res.status(400).json({
        error: 'Please upload both a guideline and a document.'
      });
    }

    const model = getField(fields, 'model', 'gpt-4o-mini');
    const mode = getField(fields, 'mode', 'balanced');

    const guidelineHtml = await fileToHtml(guidelineFile);
    const documentHtml = await fileToHtml(documentFile);

    const { htmlWithoutImages, images } = protectImages(documentHtml);

    const imagePlaceholders =
      images.map((img) => img.key).join(', ') || 'None';

    const creativityInstruction = {
      strict:
        'Make only necessary edits. Preserve the original structure, headings, bullets, tables, and sequence as much as possible.',

      balanced:
        'Improve clarity, grammar, formatting, and readability while preserving the original intent and structure.',

      creative:
        'Rewrite more actively for clarity and quality, but do not invent facts or remove important details.'
    }[mode] ||
      'Improve clarity, grammar, formatting, and readability while preserving the original intent and structure.';

    const prompt = `
You are GoFreight's internal Universal AI Refiner.

Your task:
Proofread and refine the uploaded document based on the uploaded guideline.

Guideline content:
${stripHtml(guidelineHtml)}

Processing mode:
${creativityInstruction}

Document HTML to refine:
${htmlWithoutImages}

Image placeholders that must be preserved exactly where relevant:
${imagePlaceholders}

Rules:
1. Output valid HTML only.
2. Do not include markdown fences.
3. Preserve headings, bullets, tables, screenshots/images, spacing, and procedural steps whenever possible.
4. Keep every image placeholder exactly as written, such as [[GOFREIGHT_IMAGE_1]].
5. Do not rename, remove, or wrap image placeholders in code tags.
6. Do not invent facts, product behavior, links, policies, or screenshots.
7. Improve grammar, clarity, readability, formatting, and consistency based on the uploaded guideline.
8. Keep the output easy to copy into HubSpot or other rich text editors.
`;

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You refine business documents into clean, professional, structured HTML while preserving formatting and images.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature:
        mode === 'creative'
          ? 0.5
          : mode === 'strict'
            ? 0.1
            : 0.25
    });

    const refined = cleanModelOutput(
      completion.choices?.[0]?.message?.content || ''
    );

    const restored = restoreImages(refined, images);

    return res.status(200).json({
      html: restored,
      imagesPreserved: images.length
    });
  } catch (error) {
    console.error(error);

    const message =
      error?.response?.data?.error?.message ||
      error?.message ||
      'Unknown error';

    return res.status(500).json({
      error: message
    });
  }
};

module.exports.config = {
  api: {
    bodyParser: false
  }
};
