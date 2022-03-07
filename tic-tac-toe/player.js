
class Player extends Actor {

    #symbol;
    #lastState = undefined;

    constructor(symbol, address) {
        super(address.in, address.out)
        this.#symbol = symbol;
    }

    onMessage(msg) {
        if (msg.type === "GAME_STATE") {
            this.#lastState = msg;
            this.onGameState(msg);
        }

        return msg;
    }

    onGameState(message) {

    }

    getLastState() {
        return this.#lastState;
    }

    getId() {
        return this.#symbol;
    }

    getSymbol() {
        return this.#symbol;
    }

    getLastTurn() {
        if (!this.#lastState) {
            return 0;
        }
        return this.#lastState.turn
    }
}


class RandomPlayer extends Player {
    #waitingAck = false;
    #lastMove = -1
    #processing = false
    
    constructor(symbol, address) {
        super(symbol, address)
    }

    onGameState(msg) {
        this.log("Processing turn " + msg.turn)
        if (msg.lastPlayer === this.getSymbol() && this.#waitingAck) {
            if (this.#lastMove !== msg.lastMove) {
                this.log("Move not acknowledged");
            }
            this.#lastMove = -1;
            this.#waitingAck = false;

            this.log("Last move acknowledged")
            return;
        }

        if (this.#waitingAck) {
            this.log("Awaiting ack, skip")
            return;
        }

        if (msg.nextPlayer !== this.getSymbol() || msg.result !== undefined ) {
            this.log("Not the next player, skip")
            return;
        }

        if (this.#processing) {
            return;
        }

        const randomAction = () => {
            const currentState = msg.currentState;
            const move = this.randomMove(currentState);
            const playerMoveMsg = {type: "PLAYER_MOVE", player: this.getSymbol(), move: move};
            
            this.#waitingAck = true;
            this.#lastMove = move;
            this.outbox(playerMoveMsg);
            this.#processing = false
        }

        setTimeout(randomAction, 1000);
        this.#processing = true
    }

    randomMove(state) {
        const empty = state.map((s, i) => [s, i]).filter(tup => tup[0] == "").map(tup => tup[1]);
        let randomMove = Math.ceil(Math.random()*1000 % (empty.length)) - 1;
        randomMove = randomMove < 0 ? 0 : randomMove;
        return empty[randomMove] + 1;
    }
}

class RemotePlayer extends Player {

    #remoteIncoming = []
    #remoteOutgoing = []
    #lastSentRemoteMsg

    constructor(symbol, address) {
        super(symbol, address)

        address.remoteIn(this.onRemoteIn.bind(this))
        this.remotePublish = (msg) => address.remoteOut(msg)
    }

    getState() {
        return super.getState() + ` RemoteIncoming=[${this.#remoteIncoming.length}], RemoteOutgoing=[${this.#remoteOutgoing.length}]`
    }

    onRemoteIn(message) {
        this.#remoteIncoming.push(message);
    }

    remoteOutbox(msg) {
        this.#remoteOutgoing.push(msg);
        this.log(`Remote msg queued, Type ${msg.type} Turn ${msg.turn}`);
    }

    processOutbox() {
        super.processOutbox();
        this.processRemoteOutbox();
    }

    processInbox() {
        super.processInbox();
        this.processRemoteInbox();
    }

    processRemoteOutbox() {
        if (this.#remoteOutgoing.length == 0) {
            return;
        }
        const msg = this.#remoteOutgoing.shift();
        while(this.#remoteOutgoing.length > 0 && msg.turn == this.#remoteOutgoing[0].turn) {
            this.log("Removing duplicate msg turn :" + msg.turn)
            this.#remoteOutgoing.shift();
        }

        if (this.#lastSentRemoteMsg && this.#lastSentRemoteMsg.turn == msg.turn) {
            this.log("Skipping already sent msg, turn :" + msg.turn)
        } else {
            this.remotePublish(msg);
            this.#lastSentRemoteMsg = msg;
            this.log(`Remote msg sent, Type ${msg.type} Turn ${msg.turn}`);
        }
    }

    processRemoteInbox() {
        if (this.#remoteIncoming.length == 0) {
            this.log("Remote Msg queue is empty", 1)
            return;
        }

        const msg = this.#remoteIncoming[0]
        const lastState = this.getLastState();
        if (msg.turn == lastState.turn) {
            const lastPlayerMatch = (msg.lastPlayer===lastState.lastPlayer);
            const lastMoveMatch = (msg.lastMove===lastState.lastMove);
            const nextPlayerMatch = (msg.nextPlayer===lastState.nextPlayer);
            this.log(`Compare incoming Msg(${msg.id}) vs lastState(${lastState.id}), turn=${msg.turn}, nextPlayerMatch=${nextPlayerMatch}, lastPlayerMatch=${lastPlayerMatch}, lastMoveMatch=${lastMoveMatch}`)
            this.#remoteIncoming.shift();
        }
        else if (msg.turn == lastState.turn + 1 ) {
            this.log("Remote " + this.getSymbol() + " Next Msg vs lastState", msg, lastState)

            this.publish({type: "PLAYER_MOVE", player: msg.lastPlayer, move: msg.lastMove});

            this.#remoteIncoming.shift();
        }
        else if (msg.turn < lastState.turn) {
            this.log("Remote " + this.getSymbol() + " Past Msg vs lastState", msg, lastState)
            this.#remoteIncoming.shift();
        }
        else {
            this.log("Remote " + this.getSymbol() + " Future Msg vs lastState", msg, lastState)
        }
    }

    onGameState(message) {
        this.remoteOutbox(message);
    }
}


class BoardPlayer extends Player {
    #waitingAck = false;
    #waitingInput = false;
    #lastMove = -1

    constructor(symbol, address) {
        super(symbol, address)
        this.boardIn = (msg) => address.boardIn(msg);
    }

    onMessage(msg) {
        super.onMessage(msg);
        if (msg.type === "BOARD_CLICK_EVENT") {
            this.onBoardMove(msg);
        }

        if (msg.type === "BAD_MOVE") {
            this.onBadMove(msg);
        }
    }

    onGameState(msg) {
        this.log("Processing turn " + msg.turn)
        if (msg.lastPlayer === this.getSymbol() && this.#waitingAck) {
            if (this.#lastMove !== msg.lastMove) {
                this.log("Move not acknowledged");
            }
            this.#lastMove = -1;
            this.#waitingAck = false;

            this.log("Last move acknowledged")
            return;
        }

        if (msg.nextPlayer !== this.getSymbol() || msg.result !== undefined ) {
            this.log("Not the next player, skip")
            return;
        }

        if (this.#waitingAck) {
            this.log("Awaiting ack, skip")
            return;
        }

        if (this.#waitingInput) {
            this.log("Awaiting input, skip")
            return;
        }
        
        this.#waitingInput = true;
    }

    onBadMove(msg) {
        if(!this.#waitingAck) {
            return;
        }

        if (msg.player === this.getSymbol()) {
            this.boardIn({type: "GAME_ERROR", error: "Bad move, position : " + msg.move})
            this.#lastMove = -1;
            this.#waitingAck = false;
            this.#waitingInput = true;
        }
    }
    
    onBoardMove(moveMsg) {
        this.log("Board move " + moveMsg);
        if (!this.#waitingInput) {
            this.log("Not expecting input " + moveMsg);
            return;
        }
        const playerMoveMsg = {type: "PLAYER_MOVE", player: this.getSymbol(), move: moveMsg.clickedPosition};
        this.#lastMove = moveMsg.clickedPosition;
        this.#waitingAck = true;
        this.publish(playerMoveMsg);
        this.#waitingInput = false;
    }
}
