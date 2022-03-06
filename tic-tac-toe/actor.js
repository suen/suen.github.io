class Actor {
    #incoming = [];
    #outgoing = [];
    #logLevel = 2;
    #msgHandlers = {}

    constructor(inChannel, outChannel) {
        inChannel(this.onIncoming.bind(this))
        this.publish = (msg) => outChannel(msg)
    }

    run() {
        this.onTick();
        setTimeout(this.run.bind(this), 0)
    }

    registerMessageHandler(type, handler) {
        this.#msgHandlers[type] = handler.bind(this);
    }

    onTick() {
        this.log("onTick() : " + this.getState(), 1)
        this.processInbox();
        this.processOutbox();
    }

    getState() {
        return `Incoming=[${this.#incoming.length}], Outgoing=[${this.#outgoing.length}]`
    }

    enableLog(level) {
        this.#logLevel = level
    }
    
    log(msg, level) {
        level = level || 1;
        if (level >= this.#logLevel) {
            const id = this.getId() ? "(" + this.getId() + ")" : ""
            console.log(`[${this.constructor.name} ${id}] ${msg}`)
        }
    }

    getId() {
        return ""
    }

    onIncoming(message) {
        this.#incoming.push(message);
    }

    processOutbox() {
        if (this.#outgoing.length == 0) {
            return;
        }

        const msg = this.#outgoing.shift();
        this.publish(msg);
        this.log("Msg published : " + JSON.stringify(msg))
    }

    outbox(msg) {
        this.log("Msg queued : " + JSON.stringify(msg))
        this.#outgoing.push(msg)
    }

    processInbox() {
        if (this.#incoming.length == 0) {
            this.log("Msg queue is empty")
            return;
        }
        let msg = this.#incoming.shift();

        this.onMessage(msg)
    }
    
    onMessage(msg) {
        if (!msg || !msg.type){
            return;
        }
        const type = msg.type
        const handler = this.#msgHandlers[type]
        if (!handler) {
            return;
        }
        handler(msg);
    }
}
