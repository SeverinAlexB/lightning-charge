const fs = require('fs')
const crypto = require('crypto')
const basicAuth = require('basic-auth')

module.exports.getToken = (apiToken, cookieFile) => {
  if (apiToken && cookieFile)
    throw new Error('Please specify one of --api-token or --cookie-file, not both')

  if (cookieFile) {
    if (fs.existsSync(cookieFile)) apiToken = fs.readFileSync(cookieFile).toString()
    else fs.writeFileSync(cookieFile, apiToken = crypto.randomBytes(32).toString('hex'))
  }

  if (!apiToken) throw new Error('Missing access token. Please configure one of --api-token or --cookie-file')

  return apiToken
}

module.exports.authMiddleware = (name, pass, realm='Lightning Charge') => (req, res, next) => {
  const cred = basicAuth(req)

  if (!cred || cred.name !== name || cred.pass !== pass) {
    res.set('WWW-Authenticate', `Basic realm="${realm}"`)
       .removeHeader('Access-Control-Allow-Origin')
    res.sendStatus(401)
  } else {
    next()
  }
}
