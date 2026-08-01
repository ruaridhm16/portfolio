
const toNotation = function (row, col) {
    const cols = "ABCDEFGHIJK";
    return cols.charAt(col) + String(11 - row);
};

const isBlackStatus = function (status) {
    return status.indexOf("black") === 0;
};

const getWinReason = function (status) {
    if (status === "black_wins_capture") {
        return "by capture";
    }
    if (status === "black_wins_encirclement") {
        return "by encirclement";
    }
    if (status === "black_wins_repetition") {
        return "by repetition";
    }
    if (status === "white_wins_corner") {
        return "by corner escape";
    }
    if (status === "white_wins_exitfort") {
        return "by exit fort";
    }
    return "";
};

const MESSAGES = Object.freeze({
    turnHeader: function (side, turnNumber) {
        return "Turn " + turnNumber + ": "
        + side.charAt(0).toUpperCase() + side.slice(1);
    },
    pieceMoved: function (piece, fromRow, fromCol, toRow, toCol) {
        const name = piece.charAt(0).toUpperCase() + piece.slice(1);
        const from = toNotation(fromRow, fromCol);
        const to = toNotation(toRow, toCol);
        return name + " moves from " + from + " to " + to;
    },
    pieceCaptured: function (piece, row, col) {
        const name = piece.charAt(0).toUpperCase() + piece.slice(1);
        return name + " captured at " + toNotation(row, col);
    },
    turnIndicator: function (side) {
        return side.charAt(0).toUpperCase() + side.slice(1) + "'s Turn";
    },
    winnerHeading: function (status) {
        if (isBlackStatus(status)) {
            return "Black Wins";
        }
        return "White Wins";
    },
    winReason: getWinReason,
    gameOver: function (status) {
        const side = (
            isBlackStatus(status)
            ? "Black"
            : "White"
        );
        return side + " wins " + getWinReason(status) + ".";
    }
});

export {MESSAGES, isBlackStatus, toNotation};
