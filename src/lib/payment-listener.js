const { EventEmitter } = require('events')
const { LightningClient } = require('clightning-client')
const CoreLightning = require('../CoreLightning')

const debug = require('debug')('lightning-charge')

class PaymentListener extends EventEmitter {
  constructor(model) {
    super()
    this.cln = new CoreLightning()
    this.model = model


  }

  async init() {
    await this.cln.connect()
    this.pollNext(await this.model.getLastPaid())
    // this.ln.client.on('connect', async _ =>
    //   this.pollNext(await model.getLastPaid()))
  }

  async pollNext(last_index) {
    let res;
    try {
      res = await this.cln.waitanyinvoice(last_index);
    }catch (e) {
      // timeout do again
      this.pollNext(last_index)
      return
    }
    const { label: id, pay_index, paid_at, ...cln_inv } = res
    // named `msatoshi_received` in older core lightning releases, later renamed to `amount_received_msat`
    const msatoshi_received = cln_inv.amount_received_msat || cln_inv.msatoshi_received

    if (await this.model.markPaid(id, pay_index, paid_at, msatoshi_received)) {
      const invoice = await this.model.fetchInvoice(id)
      debug('invoice %s paid: %o', invoice.id, invoice)
      this.emit('payment', invoice)
      this.emit('paid:'+id, invoice)
    } else {
      console.error('WARN: invoice %s from waitanyinvoice does not exists locally, or is already marked as paid', id)
    }

    this.pollNext(pay_index)
  }

  register(id, timeout) {
    debug('register(%s)', id)
    return new Promise((resolve, reject) => {

      const onPay = invoice => {
        clearTimeout(timer)
        this.removeListener(`paid:${ id }`, onPay)
        resolve(invoice)
      }
      this.on(`paid:${ id }`, onPay)

      const timer = setTimeout(_ => {
        debug('invoice %s listener timed out', id)
        this.removeListener(`paid:${ id }`, onPay)
        resolve(false)
      }, timeout)
    })
  }
}

// optional new
module.exports = (...a) => new PaymentListener(...a)
