const LNSocket = require('lnsocket')

class CoreLightning {
    socket;
    info;
    rune;
    async connect() {
        this.rune = process.env.LN_RUNE
        await this._init()
        this.info = await this.getinfo();
        return this.info
    }

    async _init() {
        this.socket = await LNSocket()
        this.socket.genkey()
        await this.socket.connect_and_init(process.env.LN_NODE_ID, process.env.LN_NODE_IP)
    }

    async getinfo() {
        return await this._execute(async () => {
            return await this.socket.rpc({ method: "getinfo", rune: this.rune })
        })
    }

    async invoice(msatoshi, id, desciption, expiry) {
        return await this._execute(async () => {
            return await this.socket.rpc({ method: "invoice", rune: this.rune, params: [
                msatoshi,
                id,
                desciption,
                expiry
            ] })
        })
    }

    async delinvoice(id, status) {
        return await this._execute(async () => {
            return await this.socket.rpc({ method: "delinvoice", rune: this.rune, params: [
                id,
                status
            ] })
        })
    }

    async listinvoices(id) {
        return await this._execute(async () => {
            return await this.socket.rpc({ method: "listinvoices", rune: this.rune, params: [
                id,
            ] })
        })
    }

    async waitanyinvoice(index, timeout=10) {
        return await this._execute(async () => {
            return this.socket.rpc({ method: "waitanyinvoice", rune: this.rune, params: [
                index,
                timeout
            ]})
        })
    }

    get name() {
        return `${this.info.alias} - ${this.info.id}`
    }

    async _execute(func) {
        if (!this.socket || !this.socket.connected || this.socket.closed) {
            await this._init()
        }
        const ret = await func()
        if (ret.error) {
            const err = new Error(ret.error.message)
            err.details = ret.error
            throw err
        }
        return ret.result
    }


    async destroy() {
        this.socket.destroy()
    }
}

module.exports = CoreLightning