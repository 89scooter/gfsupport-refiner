module.exports = async function handler(req, res) {

  const cookie = req.headers.cookie || '';

  if (!cookie.includes('gf_refiner_auth=true')) {
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }

  return res.status(200).json({
    success: true
  });
}
