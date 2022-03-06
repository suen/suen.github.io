function readChannel(id, name) {
    return function(listener) {
        EventBus.get(id).register(name, listener);
    }
}

function writeChannel(id, name) {
    return function(msg) {
        EventBus.get(id).publish(name, msg);
    }
}
function printer(ads, m) {
    console.log(`Broadcast[${ads}] :::: ${m.id}: [Turn ${m.turn}], [Last: ${m.lastPlayer} ${m.lastMove}], [Next: ${m.nextPlayer}], [Result : ${m.result}]`);
} 


class GameMaster extends Actor {
    #actors = []
    #address = {}
    #id;
    #protocolInProgress = false;
    #gameParam;
    #writeChannelRemoteIn;
    #readChannelRemoteOut;

    constructor(address) {
        super(address.in, address.out)
        this.registerMessageHandler("START_GAME_HOST", this.onGameHostStart)
        this.registerMessageHandler("NEW_GAME", this.onNewGameInvitation)
        this.registerMessageHandler("ACCEPT_NEW_GAME", this.onAcceptNewGame)
        this.registerMessageHandler("START_GAME", this.onGameStart)
        this.registerMessageHandler("GAME_START_OK", this.onGameStartOk)

        this.registerMessageHandler("REMOTE_PEER_DATA", this.onRemoteData)

        this.registerMessageHandler("GAME_STATE", this.onRemoteGameState)
    }

    remoteOutbox(msg) {
        const remoteEnvelope = {
            type: "REMOTE_PEER_DATA",
            content: msg
        }
        this.outbox(remoteEnvelope)
    }

    onRemoteData(msg) {
        const content = msg.content;
        this.onMessage(content);
    }

    onGameHostStart(msg) {
        if (this.#protocolInProgress) {
            this.log("onGameHostStart: Already accepted invitation/waiting invitation response", 3)
            return;
        }
        const gameParam = {
            scale: 9,
            players: {
                1: {
                    symbol: "x",
                    type: "Human"
                },
                2: {
                    symbol: "y",
                    type: "AI"
                },
                3: {
                    symbol: "o",
                    type: "AI"
                },
                4: {
                    symbol: "+",
                    type: "Human"
                }
            },
            me: 1,
            you: 4,
        }
        const hostMsg = Object.assign({type: "NEW_GAME"}, gameParam)
        this.remoteOutbox(hostMsg);
        console.log("Proposing a new game ")
        this.#protocolInProgress = true;
    }

    onNewGameInvitation(msg) {
        if (this.#protocolInProgress) {
            this.log("onNewGameInvitation : Already accepted invitation/waiting invitation response", 3)
            return;
        }
        const gamePlayers = {}
        
        const me = msg.you;

        for (let p in msg.players) {
            gamePlayers[p] = {
                symbol: msg.players[p].symbol,
                type: p == me ? "Board" : "Remote"
            }
        }

        this.#gameParam = {
            scale: msg.scale,
            players: gamePlayers,
        }

        const ackParam  = {
            type: "ACCEPT_NEW_GAME",
            scale: msg.scale,
            players: msg.players,
            me: msg["you"],
            you: msg["me"]
        }

        this.remoteOutbox(ackParam)
        console.log("Accepting game with ", this.#gameParam)
        this.#protocolInProgress = true;
    }

    onAcceptNewGame(msg) {
        const me = msg.you 
        const remote = msg.me;
        
        const players = Object.assign({}, msg.players)
        for (let p in players) {
            const player = players[p]
            if (p == me) {
                player.type = "Board"
            }
            if (p == remote) {
                player.type = "Remote"
            }
        }
        this.#gameParam = {
            scale: msg.scale,
            players: players
        }        
        console.log("Starting game with ", this.#gameParam)
        this.remoteOutbox({type: "START_GAME"})
    }

    onGameStart() {
        this.remoteOutbox({type: "GAME_START_OK"})
        this.init("2", this.#gameParam.scale, this.#gameParam.players, "peer1")
        
        
        console.log("Starting new game with ", this.#gameParam)
        this.start()
    }

    onGameStartOk() {
        this.init("1", this.#gameParam.scale, this.#gameParam.players, "peer1")
        this.start()
    }

    onRemoteGameState(msg) {
        this.#writeChannelRemoteIn(msg)
    }

    init(id, factor, players, domPrefix) {
        this.#id = id;

        const addr = {
            gameIn : "game-in-" + id,
            gameOut : "game-out-" + id,
            remoteOut : "remote-out-" + id,
            remoteIn : "remote-in-" + id,
            boardIn : "board-in-" + id, 
            boardOut : "board-out-" + id
        }
        this.#address = addr;

        const readChannelGameIn = readChannel(id, addr.gameIn);
        const writeChannelGameOut = writeChannel(id, addr.gameOut);
        const readChannelRemoteIn = readChannel(id, addr.remoteIn); 
        const writeChannelRemoteOut = writeChannel(id, addr.remoteOut); 

        const playerSymbols = Object.entries(players).sort((t1, t2) => -(t2 - t1)).map(tup => tup[1].symbol);

        const game = new Game("Game"+id, factor, playerSymbols, {in: readChannelGameIn, out: writeChannelGameOut})
        const board = new Board(domPrefix, factor, {in: readChannel(id, [addr.boardIn, addr.gameOut]), out: writeChannel(id, addr.boardOut)});

        this.addActor(game);
        this.addActor(board);

        readChannel(id, addr.gameOut)(m => printer("Game-out", m))
        
        readChannel(id, addr.remoteIn)(m => printer("RemoteIn", m))
        readChannel(id, addr.remoteOut)(m => printer("RemoteOut", m))

        const readChannelGameOut = readChannel(id, [addr.gameOut, addr.boardOut]);
        const writeChannelGameIn = writeChannel(id, addr.gameIn);
        const readChannelBoardIn = readChannel(id, addr.boardIn);

        Object.entries(players)
            .map(tup => {
                const type = tup[1].type;
                const symbol = tup[1].symbol;
                
                if (type === "AI") {
                    return new RandomPlayer(symbol, {in: readChannelGameOut, out: writeChannelGameIn});
                }
                else if (type === "Board") {
                    return new BoardPlayer(symbol, {in: readChannelGameOut, out: writeChannelGameIn, boardIn: readChannelBoardIn});
                }
                else if (type === "Remote") {
                    return new RemotePlayer(symbol, {in: readChannelGameOut, out: writeChannelGameIn, remoteIn: readChannelRemoteIn, remoteOut: writeChannelRemoteOut});
                }
            })
            .forEach(player => this.addActor(player))

        writeChannel(id, addr.boardIn)({type: "SHOW_BOARD"})
        this.#writeChannelRemoteIn = writeChannel(this.#id, this.#address.remoteIn);
        
        readChannel(this.#id, this.#address.remoteOut)(msg => this.remoteOutbox(msg));
    }

    start() {
        writeChannel(this.#id, this.#address.gameIn)({type: "GET_STATE"});
        this.runGame();
    }

    getWriterChannelRemoteIn() {
        return writeChannel(this.#id, this.#address.remoteIn);
    }

    getReaderChannelRemoteOut() {
        return readChannel(this.#id, this.#address.remoteOut);
    }

    connectToPeer(peer) {
        const peerReader = peer.getReaderChannelRemoteOut();
        const peerWriter = peer.getWriterChannelRemoteIn();

        const thisReader = this.getReaderChannelRemoteOut();
        const thisWriter = this.getWriterChannelRemoteIn();

        thisReader(msg => {console.log("Activity", msg); peerWriter(msg)})
        peerReader(msg =>  {console.log("ActivityPeer", msg); thisWriter(msg)})
    }

    addActor(actor) {
        this.#actors.push(actor);
    }

    runGame() {
        this.#actors.forEach(actor => actor.onTick())
        setTimeout(this.runGame.bind(this), 1);
    }
}