

function range(start, end) {
    let lst = []
    for (i = start; i < end; i++) {
        lst.push(i);
    }
    return lst
}

function horizontals(factor) {
  results = []
  range(0, factor).forEach(i => { 
    range(0, (factor-2)).forEach(j => {
      firstIndex = (1 +j) + (i * factor)
      results.push([firstIndex, firstIndex+1, firstIndex+2])
    })
  })
  return results
}

function verticals(factor) {
  results = []
  range(0, factor).forEach(i => {
    range(0, (factor-2)).forEach(j => {
      firstIndex = 1 + (j * factor) + i
      results.push([firstIndex, firstIndex+factor, firstIndex+factor+factor])
    })
  })
  return results
}

function diagnols(factor) {
  results = []
  range(0, (factor-2)).forEach(i => {
    range(0, (factor-2)).forEach(j => {
        firstIndex = 1 + i + (j * factor)
      results.push([firstIndex, firstIndex + (factor+1), firstIndex + (2*(factor+1))])
    })
  })

  range(3, (factor+1)).forEach(i => {
    range(0, (factor-2)).forEach(j => {
      firstIndex = i + (j * factor)  
      results.push([firstIndex, firstIndex + (factor-1), firstIndex + (2*(factor-1))])
    })
  })
  return results 
}

function calculateScores(moves, players, rules) {
  playerScores = {}
  players.forEach(player => {
    playerScores[player] = 0;
  });

  rules.forEach(rule => {
    movesRule = [moves[rule[0]-1], moves[rule[1]-1], moves[rule[2]-1]] 
    winningPlayer = getWinningPlayer(movesRule)
    if (winningPlayer != "")
      playerScores[winningPlayer] += 1
  })
  return playerScores 
}

function determineWinner(score) {
    bestScore = -1
    bestPlayer = ""
    drawScore = -1 
    drawPlayer = ""
    for (player in score) {
      if (score[player] == bestScore) {
        drawPlayer = player
        drawScore = score[player]
      } 
      if (score[player] > bestScore) {
        bestPlayer = player
        bestScore = score[player]
        drawPlayer = ""
      }
    }
  
    if (drawPlayer != "" && drawPlayer != bestPlayer) {
      return ""
    }
    else {
      return bestPlayer
    }
}

function getWinningPlayer(row) {
    first = row[0]
    for (let i = 0; i < row.length; i++) {
        if (row[i] == "") {
            return "";
        }
        if (first != row[i]) {
            return "";
        }
    }
    return first;
}


class Game extends Actor {

    #currentState;
    #moves = [];
    #factor;
    #players;
    #turn;
    #rules;
    #id;

    constructor(id, factor, players, channels) {
      super(channels.in, channels.out)
      this.#id = id;
      this.#factor = factor;
      this.#players = players;
      this.#turn = 0;
      this.#rules = horizontals(this.#factor).concat(verticals(this.#factor)).concat(diagnols(this.#factor))
      this.#initMoves();
      this.enableLog(2);
    }

    #initMoves() {
        this.#currentState = []
        for (let i = 0; i < this.#factor*this.#factor; i++) {
            this.#currentState[i] = ""
        }
    }

    getId() {
      return this.#id;
    }

    onMessage(message) {
      if (message.type === "PLAYER_MOVE") {
        this.processPlayerMove(message);
      }

      if (message.type === "GET_STATE") {
        this.#notifyState();
      }
    }

    getCurrentPlayer() {
      const nbPlayers = this.#players.length;
      return this.#players[this.#turn % nbPlayers];
    }

    processPlayerMove(msg) {  
      const playerMove = msg.move;
      const player = msg.player;
      const currentPlayer = this.getCurrentPlayer();
      
      if (this.isGameOver()) {
        return;
      }

      if (currentPlayer !== player) {
        this.log("Is not current player : ", [player, currentPlayer], 2)
        return;
      }

      if (playerMove > 0) {
        const moveResult = this.#makeMove(player, playerMove);
        if (moveResult) {
          this.log("Turn : " + this.#turn + ", Player " + player + ", move : " + playerMove, 2)
        }
        else {
          this.#notifyIllegalMove(currentPlayer, playerMove)
          this.log("Invalid move : ", msg, 2)
        }
        this.#notifyState();
      }
      else {
        this.#notifyIllegalMove(currentPlayer, playerMove)
        this.log("Not a move : ", playerMove, 2)
      }
    }

    #getCurrentState() {
        return [].concat(this.#currentState);
    }

    #calculateScore() {
        const currentScore = calculateScores(this.#currentState, this.#players, this.#rules);
        return currentScore;
    }

    isGameOver() {
        return this.#turn >= (this.#factor * this.#factor)
    }

    #makeMove(player, position) {
      if (this.getCurrentPlayer() != player || position > this.#currentState.length) {
          console.log("Not turn")
          return false;
      }

      const desiredPosition = this.#currentState[position-1];
      if (desiredPosition.trim() == "") {
          this.#moves.push([player, position])
          this.#currentState[position-1] = player;
          this.#endTurn();
          return true;
      }
      else {
          return false;
      }
    }

    #endTurn() {
        this.#turn += 1;
    }

    #notifyIllegalMove(player, move) {
      const obj = {
        type: "BAD_MOVE",
        id: this.#id,
        turn: this.#turn,
        player: player,
        move: move,
        currentState: this.#getCurrentState()
      }
      this.publish(obj)
    }

    #notifyState() {
      const lastMove = this.#moves.length > 0 ? this.#moves[this.#moves.length-1] : "";
      const moveObj = {
          type: "GAME_STATE",
          id: this.#id,
          turn : this.#turn,
          lastPlayer : lastMove[0],
          lastMove : lastMove[1],
          currentState : this.#getCurrentState(), 
          nextPlayer : this.getCurrentPlayer(),
          score: this.#calculateScore(),
      };
      const winner = this.isGameOver() ? determineWinner(moveObj.score) : undefined;
      if (winner !== undefined) {
        const result = winner == "" ? "Game is draw" : "Winner is '" + winner + "'";
        moveObj["winner"] = winner;
        moveObj["result"] = result
      }
      this.publish(moveObj);
    }
}