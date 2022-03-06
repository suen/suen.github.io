class Connection extends Actor {

    #peer;
    #conn;

    constructor (channels) {
        super(channels.in, channels.out)
        this.#peer = new Peer()
        super.registerMessageHandler("CONNECT_REMOTE_PEER", this.connectToRemotePeer)
        super.registerMessageHandler("REMOTE_PEER_DATA", this.sendData)
    }

    register() {
        this.#peer.on('open', (id => {
            console.log("My id is : ", id);
            this.outbox({type: "PEER_REGISTERED", id: id})
        }).bind(this))
        this.#peer.on("connection", this.onRemoteConnection.bind(this))        
        this.#peer.on("disconnected", this.onDisconnected.bind(this))        
    }
    
    onRemoteConnection(conn) {
        console.log("Received connection from ", conn);
        this.outbox({type: "REMOTE_PEER_CONNECTED", remotePeerId: conn.peer})
        this.openConnection(conn);
    }

    onDisconnected(conn) {
        console.log("Received disconnection from ", conn);
        this.outbox({type: "REMOTE_PEER_DISCONNECTED", remotePeerId: conn.peer})
    }

    openConnection(conn) {
        conn.on('open', (() => {
            console.log("Connection open ", conn);
            this.onOpen(conn)
            this.outbox({type: "REMOTE_PEER_CONNECTED", remotePeerId: conn.peer})
        }).bind(this))
    }

    onOpen(conn) {
        this.#conn = conn;
        window.conn = conn;
        this.#conn.on('data', this.onData.bind(this))
    }

    onData(data) {
        console.log("Received from id " + this.#conn.peer, data)
        this.outbox({type: "REMOTE_PEER_DATA", content: data})
    }
    
    connectToRemotePeer(msg) {
        const conn = this.#peer.connect(msg.remotePeerId);
        this.openConnection(conn)
    }

    sendData(msg) {
        console.log("Sending to remote", msg.content);
        this.#conn.send(msg.content)
    }
}
