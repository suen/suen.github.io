class EventBus {

    #id;
    #topicConsumer = {};
    #eventQueue = []

    static instances = {};

    constructor(id) {
        this.onTick();
        this.#id = id;
    }

    static readChannel(id, name) {
        return function(listener) {
            EventBus.get(id).register(name, listener);
        }
    }
    
    static writeChannel(id, name) {
        return function(msg) {
            EventBus.get(id).publish(name, msg);
        }
    }

    static closeChannel(name, ch) {
        
    }

    static get(keyParam) {
        const key = keyParam || "default";
       
        EventBus.instances[key] = EventBus.instances[key] || new EventBus(key);
        return EventBus.instances[key];
    }

    register(channels, consumer) {
        if (channels instanceof Array) {
            channels.forEach(channel => this.#registerChannel(channel, consumer))
        }
        else {
            this.#registerChannel(channels, consumer)
        }
    }

    #registerChannel(channel, consumer) {
        this.#topicConsumer[channel] = this.#topicConsumer[channel] || []
        this.#topicConsumer[channel].push(consumer)
    }

    dispose() {
        this.#topicConsumer = {}
        this.#eventQueue = []
        EventBus.instances[this.#id] = undefined;
    }

    #unregisterChannel(topic, consumer) {
        if (this.#topicConsumer[topic]) {
            const index = this.#topicConsumer[topic].indexOf(consumer);
            this.#topicConsumer[topic].splice(index, 1)
        }
    }

    unregister(channels, consumer) {
        if (channels instanceof Array) {
            channels.forEach(channel => this.#unregisterChannel(channel, consumer))
        }
        else {
            this.#unregisterChannel(channels, consumer)
        }
    }

    publish(topic, event) {
        this.#eventQueue.push([topic, event])
    }

    processQueue() {
        if (this.#eventQueue.length == 0) {
            return;
        }
        this.#eventQueue.forEach(tuple => this.processMessage(tuple[0], tuple[1]))
        this.#eventQueue = []
    }

    onTick() {
        this.processQueue();
        setTimeout(this.onTick.bind(this), 0);
    }

    processMessage(topic, event) {
        this.#topicConsumer[topic] = this.#topicConsumer[topic] || []
        this.#topicConsumer[topic].forEach(consumer => consumer(event));
    }

    static selfTest() {
        const writer = EventBus.writeChannel("1000", "test-channel");
        const pingMessage = {"type": "PING"};
        writer(pingMessage);
        EventBus.readChannel("1000", "test-channel")(msg => {
            console.log("Received ", msg, " Msg comparision result : ", pingMessage === msg);
        })
    }
}