const { join } = require('path')
require('dotenv').config();
const wrap = require('./lib/promise-wrap')
const { getToken, authMiddleware } = require('./lib/auth')
const CoreLightning = require('./CoreLightning');

const apiToken = getToken(process.env.API_TOKEN, process.env.COOKIE_FILE);

;(async () => {
  const db = require('knex')(require('../knexfile'));
  const cln = new CoreLightning()
  try {
    await cln.connect()
    console.log('Connected to', cln.name)
  } catch (e) {
    console.error('Failed to connect to core-lightning', e)
    return
  }



  await db.migrate.latest({ directory: join(__dirname, '../migrations') })

  const model = require('./model')(db, cln)
  const auth  = authMiddleware('api-token', apiToken);
  const payListen = require('./lib/payment-listener')(model);
  await payListen.init()

  const app = require('express')()

  app.set('port', process.env.PORT || 9112)
  app.set('host', process.env.HOST || 'localhost')
  app.set('trust proxy', process.env.PROXIED || 'loopback')

  app.use(require('morgan')('dev'))
  app.use(require('body-parser').json())
  app.use(require('body-parser').urlencoded({ extended: true }))

  process.env.ALLOW_CORS && app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', process.env.ALLOW_CORS)
    res.set('Access-Control-Allow-Headers', 'Content-Type, Accept')
    res.set('Access-Control-Allow-Methods', 'GET, DELETE, POST')
    next()
  })

  app.get('/info', auth, wrap(async (req, res) => res.send(await cln.getinfo())))

  require('./invoicing')(app, payListen, model, auth, null)
  require('./checkout')(app, payListen)

  require('./sse')(app, payListen, auth)
  require('./webhook')(app, payListen, model, auth)
  require('./websocket')(app, payListen, apiToken)

  app.use((err, req, res, next) =>
    err.name == 'LightningError' ? res.status(err.status || 400).send(err.toString())
  : next(err)
  )

  const server = app.listen(app.settings.port, app.settings.host, _ => {
    console.log(`HTTP server running on ${ app.settings.host }:${ app.settings.port }`)
    app.emit('listening', server)
  })
})()

process.on('unhandledRejection', err => { 
  console.error('Unhandled rejection', err); 
  throw err 
})

process.on('uncaughtException', function (err) {
  console.error('Unhandled exception', err); 
  throw err 
});

process.on('SIGTERM', err => {
  console.error('Caught SIGTERM, shutting down')
  process.exit(0)
})
