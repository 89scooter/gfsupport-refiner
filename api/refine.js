const OpenAI = require('openai');
const formidable = require('formidable');
const mammoth = require('mammoth');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

module.exports.config = {
  api: {
    bodyParser: false
  }
};

async function readFileContent(file) {

  const fs = require('fs');

  const buffer = fs.readFileSync(file.filepath);

  if (file.originalFilename.endsWith('.docx')) {

    const result = await mammoth.convertToHtml(
      { buffer },
      {
        convertImage: mammoth.images.inline(async element => {
          return element.read('base64').then(imageBuffer => {
            return {
              src: `data:${element.contentType};base64,${imageBuffer}`
            };
          });
        })
      }
    );

    return result.value;
  }

  return buffer.toString('utf8');
}

module.exports = async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const cookie = req.headers.cookie || '';

  if (!cookie.includes('gf_refiner_auth=true')) {
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY missing'
    });
  }

  const form = formidable({
    multiples: false
  });

  form.parse(req, async (err, fields, files) => {

    try {

      if (err) {
        return res.status(500).json({
          error: 'Failed to parse upload'
        });
      }

      const guidelineFile = files.guideline?.[0];
      const documentFile = files.document?.[0];

      if (!guidelineFile || !documentFile) {
        return res.status(400).json({
          error: 'Missing files'
        });
      }

      const guidelineContent = await readFileContent(guidelineFile);
      const documentContent = await readFileContent(documentFile);

      const model = fields.model?.[0] || 'gpt-4o-mini';
      const mode = fields.mode?.[0] || 'balanced';

      let modeInstruction = '';

      if (mode === 'strict') {
        modeInstruction = `
Preserve original structure as much as possible.
Only fix grammar, clarity, formatting consistency, and wording.
`;
      }

      if (mode === 'balanced') {
        modeInstruction = `
Improve readability, wording, clarity, and professionalism
while preserving overall layout and meaning.
`;
      }

      if (mode === 'creative') {
        modeInstruction = `
Rewrite more aggressively for better readability,
professionalism, and customer-facing quality.
`;
      }

      const prompt = `
You are a professional documentation refiner.

Your job:
- Follow the uploaded guideline carefully
- Refine the uploaded document
- Preserve tables
- Preserve bullet points
- Preserve images
- Preserve HTML formatting
- Return ONLY clean HTML
- Do not wrap with markdown
- Do not include explanation

=== GUIDELINE ===
${guidelineContent}

=== MODE ===
${modeInstruction}

=== DOCUMENT ===
${documentContent}
`;

      const completion = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert HTML documentation refiner.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3
      });

      const html = completion.choices[0].message.content
        .replace(/^```html/i, '')
        .replace(/^```/i, '')
        .replace(/```$/i, '')
        .trim();

      const imageCount =
        (html.match(/<img/gi) || []).length;

      return res.status(200).json({
        html,
        imagesPreserved: imageCount
      });

    } catch (error) {

      console.error(error);

      return res.status(500).json({
        error: error.message || 'Unexpected server error'
      });
    }
  });
};
