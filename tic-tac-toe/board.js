class Board extends Actor {

    #COLORS = ["#0d6efd", "#198754", "#3c0035", "#5f2927", "#856f6d"]
    #playerSymbols = []
    #peerPrefix = ""
    #boardContainer

    constructor(peerPrefix, factor, address) {
        super(address.in, address.out)
        this.#peerPrefix = peerPrefix;
        this.createMarkup(factor);
        this.cells = document.getElementsByClassName(this.#peerPrefix+"-cell");
        this.#boardContainer = document.getElementById("board");

        this.registerMessageHandler("GAME_STATE", this.onGameMsg)
        this.registerMessageHandler("BAD_MOVE", this.fillError)
        this.registerMessageHandler("SHOW_BOARD", this.onShowBoard)
    }

    createMarkup(factor) {
        const table = document.getElementById(this.#peerPrefix+"-grid");
        let count = 1;
        for (let i = 0; i < factor; i++) {
            const tr = document.createElement("tr");
            for (let j = 0; j < factor; j++) {
                const td = document.createElement("td");
                td.classList.add(this.#peerPrefix + "-cell")
                td.classList.add("cell")
                tr.append(td)
                td.onclick = this.clickHandler.bind(this)
                td.innerText = count
                td.id = count;
                td.style = "opacity : 0.2"
                count++
            }
            table.append(tr)
        }
    }

    clickHandler(event) {
        const clickedCell = event.target;
        const clickedPosition = clickedCell.id
        this.outbox({type: "BOARD_CLICK_EVENT", clickedPosition: clickedPosition})
    }

    onGameMsg(msg) {
        this.fillMoves(msg.currentState); 
        this.fillScore(msg.score, msg.result);
        this.fillStatus("Current player: " + msg.nextPlayer + "<br> Turn: " + msg.turn)
    }

    onShowBoard(msg) {
        this.#boardContainer.style = ""
    }

    fillInfo(msg) {
        document.getElementById(this.#peerPrefix+"-result").innerHTML = msg;
    }
    
    fillError(msg) {
        const errorMsg = "Bad move " + msg.move
        document.getElementById(this.#peerPrefix+"-error").innerText = errorMsg
    }

    clear() {
        document.getElementById(this.#peerPrefix+"-result").innerHTML = ""
        document.getElementById(this.#peerPrefix+"-error").innerText = ""
    }

    fillStatus(status) {
        document.getElementById(this.#peerPrefix+"-status").innerHTML = "<h2>" + status + "</h2>";
    }
    
    fillScore(score, msg) {
        let scoreMsg = ""
        for(let player in score) {
            scoreMsg += "<h3>" + player + " = " + score[player] + "</h3>"; 
        }
        scoreMsg += msg === undefined ? "" : "<h3>" + msg + "</h3>";
        this.fillInfo(scoreMsg);
    }

    symbolColors(symbol) {
        let index = this.#playerSymbols.indexOf(symbol);
        if (index == -1) {
            this.#playerSymbols.push(symbol)
            index = this.#playerSymbols.length - 1
        }
        index = index >= this.#COLORS.length ? 0 : index;
        return this.#COLORS[index];
    }

    fillMoves(moves) {
        const cells = this.cells;
        for (let i = 0; i < cells.length; i++) {
            const position = cells[i].id;
            const symbol = moves[position-1];
            if (symbol != "") {
                const color = this.symbolColors(symbol)
                cells[i].innerText = symbol;
                cells[i].style = "opacity : 1; color: white; background: " + color 
            }
        }           
    }
}