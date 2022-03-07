function getRemotePeerId() {
    return localStorage.getItem("remotePeerId") || ""
}

function setRemotePeerId(id) {
    localStorage.setItem("remotePeerId", id)
}

class AdminUI extends Actor {
    #uiNetworkInfo;
    #uiRemotePeerStatus;
    #uiRemotePeerConnect;
    #uiRemotePeerId;
    #uiRemoteConnectBtn;
    #uiNewGameBtn;
    #awaitingAck = false;

    constructor(address) {
        super(address.in, address.out)
        this.#uiNetworkInfo = document.getElementById("network-info");
        this.#uiRemotePeerStatus = document.getElementById("remote-peer-connect-status");
        this.#uiRemotePeerConnect = document.getElementById("remote-peer-connect");
        this.#uiRemotePeerId = document.getElementById("remote-peer-id");
        this.#uiRemoteConnectBtn = document.getElementById("remote-connect-btn");
        this.#uiNewGameBtn = document.getElementById("game-init-button");
        this.init();
    }

    init() {
        this.#uiNetworkInfo.innerText = "Registering ..."
        this.#hide(this.#uiRemotePeerStatus);
        this.#hide(this.#uiRemotePeerConnect);
        this.#hide(this.#uiNewGameBtn);
        this.#uiRemotePeerId.value = "";

        this.#uiNewGameBtn.onclick = this.#onGameStartClick.bind(this)
        this.#uiRemoteConnectBtn.onclick = this.#onRemoteConnectClick.bind(this)
    }

    #onGameStartClick() {
        this.outbox({type: "START_GAME_HOST"})
    }

    #onRemoteConnectClick() {
        const remoteId = this.#uiRemotePeerId.value;
        if (this.#awaitingAck) {
            this.log("Ignoring " + remoteId + ", already awaiting response")
            return;
        }

        this.#uiRemotePeerStatus.innerText = "Connecting to remote : '" + remoteId + "' ..."
        this.#unHide(this.#uiRemotePeerStatus);
        this.#hide(this.#uiRemotePeerConnect);

        this.outbox({type : "CONNECT_REMOTE_PEER", remotePeerId: remoteId});
        this.#awaitingAck = true;
    }

    #hide(element) {
        element.style = "display: none;"
    }

    #unHide(element) {
        element.style = ""
    }

    onMessage(msg) {
        if (msg.type  === "PEER_REGISTERED") {
            this.onRegistered(msg.id);
        }
        else if (msg.type === "REMOTE_PEER_CONNECTED") {
            this.onRemotePeerConnected(msg.remotePeerId);
        }
        else if (msg.type === "REMOTE_PEER_DISCONNECTED") {
            this.onRemotePeerDisconnected(msg.remotePeerId);
        }
        else if (msg.type === "REMOTE_PEER_ERROR") {
            this.onRemoteConnectionError(msg.remotePeerId);
        }
        else if (msg.type === "REMOTE_PEER_DATA" && msg.content.type === "GAME_STATE") {
            this.onGameState(msg.content);
        }
    }

    onGameState(msg) {
        this.#uiNewGameBtn.disabled = (msg.result === undefined)
    }

    onRegistered(id) {
        this.#uiNetworkInfo.innerText = "Your id is : " + id;
        this.#unHide(this.#uiRemotePeerConnect);
        this.#uiRemotePeerId.value = getRemotePeerId();
    }

    #ackReceived() {
        this.#awaitingAck = false;
    }

    onRemotePeerConnected(id) {
        this.#uiRemotePeerStatus.innerText = "Connected to remote : " + id
        this.#unHide(this.#uiRemotePeerStatus);
        this.#hide(this.#uiRemotePeerConnect);
        this.#ackReceived();
        this.#activateGame();
        setRemotePeerId(id);
    }

    #activateGame() {
        this.#unHide(this.#uiNewGameBtn)
    }

    onRemotePeerDisconnected(id) {
        this.#uiRemotePeerStatus.innerText = "Disconnected : " + id
        this.#unHide(this.#uiRemotePeerConnect);
        this.#ackReceived();
    }

    onRemoteConnectionError(id) {
        this.#uiRemotePeerStatus.innerText = "Try again ! Error connecting to " + id
        this.#unHide(this.#uiRemotePeerConnect);
        this.#ackReceived();
    }

    static selfTest() {
        const adminUI = new AdminUI({in: EventBus.readChannel("100", "admin-in"), out: EventBus.writeChannel("100", "admin-out")});
        const writer = EventBus.writeChannel("100", "admin-in")
        writer({type: "PEER_REGISTERED", id: "random-id"})

        EventBus.readChannel("1", "admin-out")(msg => {
            console.log("Received", msg)
            setTimeout(() => writer({type: "REMOTE_PEER_CONNECTED", remotePeerId: msg.remotePeerId}), 1000)
            setTimeout(() => writer({type: "REMOTE_PEER_DISCONNECTED", remotePeerId: msg.remotePeerId}), 5000)
        });
        adminUI.run();
    }
}
