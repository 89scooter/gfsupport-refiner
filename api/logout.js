module.exports = async function handler(req, res) {

  res.setHeader(
    'Set-Cookie',
    'gf_refiner_auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
  );

  return res.status(200).json({
    success: true
  });
}
