module.exports = async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const { accessCode } = req.body;

  const expectedCode = process.env.ACCESS_CODE;

  if (!expectedCode) {
    return res.status(500).json({
      error: 'ACCESS_CODE is missing on server'
    });
  }

  if (accessCode !== expectedCode) {
    return res.status(401).json({
      error: 'Invalid access code'
    });
  }

  return res.status(200).json({
    success: true
  });
}
