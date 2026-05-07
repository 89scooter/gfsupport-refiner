import OpenAI from 'openai';
import formidable from 'formidable';
import mammoth from 'mammoth';
import fs from 'fs/promises';

export const config = {
  api: {
    bodyParser: false
  },
  maxDuration: 60
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function getField(fields, key, defaultValue = '') {
  const value = fields[key];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value || defaultValue;
}

function protectImages(html) {
  const images = [];

  const htmlWithoutImages = html.replace(
    /<img\b[^>]*>/gi,
    (match) => {
      const placeholder =
        `[[GOFREIGHT_IMAGE_${images.length + 1}]]`;

      images.push({
        placeholder,
        original: match
      });

      return placeholder;
    }
  );

  return {
    htmlWithoutImages,
    images
  };
}

function restoreImages(html, images) {
  let restored = html;

  for (const image of images) {
    restored =
      restored.replaceAll(
        image.placeholder,
        image.original
      );
  }

  return restored;
}

async function readFileContent(file) {
  if (!file) {
    return '';
  }

  const filepath =
    file.filepath || file.path;

  const buffer = await fs.readFile(filepath);

  const filename =
    file.originalFilename || '';

  if (
    filename.endsWith('.html') ||
    filename.endsWith('.htm')
  ) {
    return buffer.toString('utf8');
  }

  if (filename.endsWith('.txt')) {
    return buffer.toString('utf8');
  }

  if (filename.endsWith('.docx')) {
    const result =
      await mammoth.convertToHtml({
        buffer
      });

    return result.value;
  }

  return buffer.toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({
        error: 'Method not allowed'
      });
  }

  try {
    const form =
      formidable({
        multiples: false
      });

    const {
      fields,
      files
    } = await new Promise(
      (resolve, reject) => {
        form.parse(
          req,
          (err, fields, files) => {
            if (err) {
              reject(err);
            } else {
              resolve({
                fields,
                files
              });
            }
          }
        );
      }
    );

    const guidelineFile =
      Array.isArray(files.guideline)
        ? files.guideline[0]
        : files.guideline;

    const documentFile =
      Array.isArray(files.document)
        ? files.document[0]
        : files.document;

    const model =
      getField(
        fields,
        'model',
        'gpt-4o-mini'
      );

    const mode =
      getField(
        fields,
        'mode',
        'balanced'
      );

    const refineType =
      getField(
        fields,
        'refineType',
        'normal'
      );

    const guideline =
      await readFileContent(
        guidelineFile
      );

    const documentHtml =
      await readFileContent(
        documentFile
      );

    let htmlWithoutImages;
    let images = [];

    if (refineType === 'text-only') {
      htmlWithoutImages =
        documentHtml
          .replace(
            /<img\b[^>]*>/gi,
            '[IMAGE_REMOVED_FOR_TEXT_ONLY_MODE]'
          )
          .replace(
            /data:image\/[^;]+;base64,[^"]+/gi,
            '[BASE64_REMOVED]'
          );
    } else {
      const protectedResult =
        protectImages(
          documentHtml
        );

      htmlWithoutImages =
        protectedResult.htmlWithoutImages;

      images =
        protectedResult.images;
    }

    const systemPrompt = `
You are a professional editor for GoFreight Support documentation.

Your job is to refine and proofread the provided document according to the guideline.

Rules:

1. Preserve HTML structure whenever possible.
2. Preserve tables, bullets, numbering, and formatting.
3. Do NOT remove important business information.
4. Keep every image placeholder exactly as written, such as [[GOFREIGHT_IMAGE_1]].
4a. If text-only mode is used, ignore image processing and focus only on text refinement.
5. Improve grammar, tone, clarity, readability, and professionalism.
6. Keep the final output in valid HTML format.
7. Avoid adding explanations outside the HTML.
`;

    const userPrompt = `
=== GUIDELINE ===

${guideline}

=== DOCUMENT ===

${htmlWithoutImages}

=== MODE ===

${mode}
`;

    const completion =
      await client.chat.completions.create({
        model,
        temperature:
          mode === 'strict'
            ? 0.1
            : mode === 'creative'
            ? 0.8
            : 0.4,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ]
      });

    let refined =
  completion.choices?.[0]
    ?.message?.content ||
  '<p>No response.</p>';

refined = refined
  .replace(/^```html\s*/i, '')
  .replace(/^```\s*/i, '')
  .replace(/\s*```$/i, '')
  .trim();

    const restored =
      refineType === 'text-only'
        ? refined
        : restoreImages(
            refined,
            images
          );

    return res.status(200).json({
      html: restored,
      imagesPreserved:
        images.length,
      refineType
    });
  } catch (err) {
    console.error(err);

    const message =
      err?.message ||
      'Unexpected server error';

    return res.status(500).json({
      error: message,
      timeoutHint:
        'If the article is large or contains many images, please try Text-only Refine.'
    });
  }
}
