import assert from "assert";
import fc from "fast-check";
import {
    createGame,
    getLegalMoves,
    movePiece,
    switchTurn,
    checkCaptures,
    checkWinCondition,
    boardToString
} from "../tafl.js";

const countPieces = function (board, piece) {
    return board.reduce(function (total, row) {
        return total + row.filter(function (cell) {
            return cell.piece === piece;
        }).length;
    }, 0);
};

const placePiece = function (board, row, col, piece) {
    return board.map(function (r, ri) {
        return r.map(function (cell, ci) {
            if (ri === row && ci === col) {
                return {terrain: cell.terrain, piece};
            }
            return cell;
        });
    });
};

const removePiece = function (board, row, col) {
    return placePiece(board, row, col, null);
};

const emptyBoard = function () {
    return createGame().board.map(function (row) {
        return row.map(function (cell) {
            return {terrain: cell.terrain, piece: null};
        });
    });
};

describe("createGame", function () {
    it("starts with exactly 24 black pieces", function () {
        const game = createGame();
        assert.strictEqual(countPieces(game.board, "black"), 24);
    });

    it("starts with exactly 12 white pieces", function () {
        const game = createGame();
        assert.strictEqual(countPieces(game.board, "white"), 12);
    });

    it("starts with exactly 1 king", function () {
        const game = createGame();
        assert.strictEqual(countPieces(game.board, "king"), 1);
    });

    it("starts with black's turn", function () {
        assert.strictEqual(createGame().turn, "black");
    });

    it("starts with playing status", function () {
        assert.strictEqual(createGame().status, "playing");
    });

    it("starts with empty history", function () {
        assert.deepStrictEqual(createGame().history, []);
    });

    it("king starts at position row 5 col 5", function () {
        const game = createGame();
        assert.strictEqual(
            game.board[5][5].piece,
            "king"
        );
    });

    it("all four corners are empty at game start", function () {
        const board = createGame().board;
        assert.strictEqual(board[0][0].piece, null);
        assert.strictEqual(board[0][10].piece, null);
        assert.strictEqual(board[10][0].piece, null);
        assert.strictEqual(board[10][10].piece, null);
    });
});

describe("getLegalMoves", function () {

    it("never returns moves outside board bounds", function () {
        fc.assert(fc.property(
            fc.integer({min: 0, max: 10}),
            fc.integer({min: 0, max: 10}),
            function (row, col) {
                const board = createGame().board;
                if (board[row][col].piece === null) {
                    return true;
                }
                const moves = getLegalMoves(board, row, col);
                return moves.every(function (move) {
                    return (
                        move[0] >= 0 && move[0] <= 10
                        && move[1] >= 0 && move[1] <= 10
                    );
                });
            }
        ));
    });

    it("never returns the piece's own square as a legal move", function () {
        fc.assert(fc.property(
            fc.integer({min: 0, max: 10}),
            fc.integer({min: 0, max: 10}),
            function (row, col) {
                const board = createGame().board;
                if (board[row][col].piece === null) {
                    return true;
                }
                const moves = getLegalMoves(board, row, col);
                return moves.every(function (move) {
                    return !(move[0] === row && move[1] === col);
                });
            }
        ));
    });

    it("never returns an occupied square as a legal move", function () {
        fc.assert(fc.property(
            fc.integer({min: 0, max: 10}),
            fc.integer({min: 0, max: 10}),
            function (row, col) {
                const board = createGame().board;
                if (board[row][col].piece === null) {
                    return true;
                }
                const moves = getLegalMoves(board, row, col);
                return moves.every(function (move) {
                    return board[move[0]][move[1]].piece === null;
                });
            }
        ));
    });

    it("only returns squares in same row or column as piece", function () {
        fc.assert(fc.property(
            fc.integer({min: 0, max: 10}),
            fc.integer({min: 0, max: 10}),
            function (row, col) {
                const board = createGame().board;
                if (board[row][col].piece === null) {
                    return true;
                }
                const moves = getLegalMoves(board, row, col);
                return moves.every(function (move) {
                    return move[0] === row || move[1] === col;
                });
            }
        ));
    });

    it("does not allow a non-king piece to land on a corner", function () {
        const board = createGame().board;
        const moves = getLegalMoves(board, 0, 3);
        const corners = [[0, 0], [0, 10], [10, 0], [10, 10]];
        assert.strictEqual(
            moves.some(function (move) {
                return corners.some(function (corner) {
                    return (
                        corner[0] === move[0]
                        && corner[1] === move[1]
                    );
                });
            }),
            false
        );
    });

    it("does not allow a non-king piece to land on the throne", function () {
        const board = createGame().board;
        const moves = getLegalMoves(board, 5, 1);
        assert.strictEqual(
            moves.some(function (move) {
                return move[0] === 5 && move[1] === 5;
            }),
            false
        );
    });

    it("allows the king to land on a corner when path is clear", function () {
        let board = emptyBoard();
        board = placePiece(board, 0, 5, "king");
        const moves = getLegalMoves(board, 0, 5);
        assert.strictEqual(
            moves.some(function (move) {
                return move[0] === 0 && move[1] === 0;
            }),
            true
        );
    });

    it(
        "returns empty array when piece is blocked in all directions",
        function () {
            let board = emptyBoard();
            board = placePiece(board, 5, 5, "black");
            board = placePiece(board, 4, 5, "black");
            board = placePiece(board, 6, 5, "black");
            board = placePiece(board, 5, 4, "black");
            board = placePiece(board, 5, 6, "black");
            const moves = getLegalMoves(board, 5, 5);
            assert.deepStrictEqual(moves, []);
        }
    );
});

describe("movePiece", function () {

    it("places the piece at the destination square", function () {
        const board = createGame().board;
        const newBoard = movePiece(board, 5, 5, 5, 3);
        assert.strictEqual(newBoard[5][3].piece, "king");
    });

    it("clears the origin square after moving", function () {
        const board = createGame().board;
        const newBoard = movePiece(board, 5, 5, 5, 3);
        assert.strictEqual(newBoard[5][5].piece, null);
    });

    it("does not mutate the original board", function () {
        fc.assert(fc.property(
            fc.integer({min: 0, max: 10}),
            fc.integer({min: 0, max: 10}),
            fc.integer({min: 0, max: 10}),
            fc.integer({min: 0, max: 10}),
            function (fr, fc_, tr, tc) {
                const board = createGame().board;
                const snapshot = boardToString(board);
                movePiece(board, fr, fc_, tr, tc);
                return boardToString(board) === snapshot;
            }
        ));
    });

    it("does not change the total piece count", function () {
        fc.assert(fc.property(
            fc.integer({min: 0, max: 10}),
            fc.integer({min: 0, max: 10}),
            function (row, col) {
                const board = createGame().board;
                if (board[row][col].piece === null) {
                    return true;
                }
                const moves = getLegalMoves(board, row, col);
                if (moves.length === 0) {
                    return true;
                }
                const move = moves[0];
                const before = (
                    countPieces(board, "black")
                    + countPieces(board, "white")
                    + countPieces(board, "king")
                );
                const newBoard = movePiece(board, row, col, move[0], move[1]);
                const after = (
                    countPieces(newBoard, "black")
                    + countPieces(newBoard, "white")
                    + countPieces(newBoard, "king")
                );
                return before === after;
            }
        ));
    });

    it("only changes the origin and destination squares", function () {
        const board = createGame().board;
        const newBoard = movePiece(board, 5, 5, 5, 3);
        let changedCount = 0;
        let r = 0;
        while (r <= 10) {
            let c = 0;
            while (c <= 10) {
                if (board[r][c].piece !== newBoard[r][c].piece) {
                    changedCount += 1;
                }
                c += 1;
            }
            r += 1;
        }
        assert.strictEqual(changedCount, 2);
    });

    it("preserves terrain of all squares after a move", function () {
        const board = createGame().board;
        const newBoard = movePiece(board, 5, 5, 5, 3);
        let r = 0;
        while (r <= 10) {
            let c = 0;
            while (c <= 10) {
                assert.strictEqual(
                    board[r][c].terrain,
                    newBoard[r][c].terrain
                );
                c += 1;
            }
            r += 1;
        }
    });
});

describe("checkCaptures", function () {

    describe("standard sandwich capture", function () {

        it(
            "captures a black piece sandwiched between two white pieces",
            function () {
                let board = emptyBoard();
                board = placePiece(board, 5, 3, "white");
                board = placePiece(board, 5, 4, "black");
                board = placePiece(board, 5, 5, "white");
                const result = checkCaptures(board, 5, 5, "white");
                assert.strictEqual(result[5][4].piece, null);
            }
        );

        it(
            "captures a white piece sandwiched between two black pieces",
            function () {
                let board = emptyBoard();
                board = placePiece(board, 3, 5, "black");
                board = placePiece(board, 4, 5, "white");
                board = placePiece(board, 5, 5, "black");
                const result = checkCaptures(board, 5, 5, "black");
                assert.strictEqual(result[4][5].piece, null);
            }
        );

        it("does not capture a piece that moved into a sandwich", function () {
            let board = emptyBoard();
            board = placePiece(board, 5, 3, "white");
            board = placePiece(board, 5, 5, "white");
            board = placePiece(board, 5, 4, "black");
            const result = checkCaptures(board, 5, 4, "black");
            assert.strictEqual(result[5][4].piece, "black");
        });

        it("does not capture a friendly piece", function () {
            let board = emptyBoard();
            board = placePiece(board, 5, 3, "black");
            board = placePiece(board, 5, 4, "black");
            board = placePiece(board, 5, 5, "white");
            const result = checkCaptures(board, 5, 5, "white");
            assert.strictEqual(result[5][4].piece, "black");
        });
    });

    describe("hostile squares", function () {

        it(
            "captures black piece sandwiched between white and corner",
            function () {
                let board = emptyBoard();
                board = placePiece(board, 0, 1, "black");
                board = placePiece(board, 0, 2, "white");
                const result = checkCaptures(board, 0, 2, "white");
                assert.strictEqual(result[0][1].piece, null);
            }
        );

        it(
            "captures black piece sandwiched between white and throne",
            function () {
                let board = emptyBoard();
                board = placePiece(board, 5, 4, "black");
                board = placePiece(board, 5, 3, "white");
                const result = checkCaptures(board, 5, 3, "white");
                assert.strictEqual(result[5][4].piece, null);
            }
        );

        it("captures white piece against empty throne", function () {
            let board = emptyBoard();
            board = placePiece(board, 5, 4, "white");
            board = placePiece(board, 5, 3, "black");
            const result = checkCaptures(board, 5, 3, "black");
            assert.strictEqual(result[5][4].piece, null);
        });

        it("does not capture white piece against occupied throne", function () {
            let board = emptyBoard();
            board = placePiece(board, 5, 5, "king");
            board = placePiece(board, 5, 4, "white");
            board = placePiece(board, 5, 3, "black");
            const result = checkCaptures(board, 5, 3, "black");
            assert.strictEqual(result[5][4].piece, "white");
        });
    });

    describe("king capture", function () {

        it("captures king surrounded on all 4 sides by black", function () {
            let board = emptyBoard();
            board = placePiece(board, 3, 3, "king");
            board = placePiece(board, 2, 3, "black");
            board = placePiece(board, 4, 3, "black");
            board = placePiece(board, 3, 2, "black");
            board = placePiece(board, 3, 4, "black");
            const result = checkCaptures(board, 4, 3, "black");
            assert.strictEqual(result[3][3].piece, null);
        });

        it("does not capture king on the board edge", function () {
            let board = emptyBoard();
            board = placePiece(board, 0, 5, "king");
            board = placePiece(board, 0, 4, "black");
            board = placePiece(board, 0, 6, "black");
            board = placePiece(board, 1, 5, "black");
            const result = checkCaptures(board, 1, 5, "black");
            assert.strictEqual(result[0][5].piece, "king");
        });

        it("captures king adjacent to throne with 3 black pieces", function () {
            let board = emptyBoard();
            board = placePiece(board, 5, 4, "king");
            board = placePiece(board, 4, 4, "black");
            board = placePiece(board, 6, 4, "black");
            board = placePiece(board, 5, 3, "black");
            const result = checkCaptures(board, 5, 3, "black");
            assert.strictEqual(result[5][4].piece, null);
        });

        it("king needs all 4 sides covered when not near throne", function () {
            let board = emptyBoard();
            board = placePiece(board, 3, 3, "king");
            board = placePiece(board, 2, 3, "black");
            board = placePiece(board, 4, 3, "black");
            board = placePiece(board, 3, 2, "black");
            const result = checkCaptures(board, 4, 3, "black");
            assert.strictEqual(result[3][3].piece, "king");
        });
    });

    describe("shieldwall capture", function () {

        it("captures 2 edge pieces when fully bracketed", function () {
            let board = emptyBoard();
            board = placePiece(board, 0, 3, "black");
            board = placePiece(board, 0, 4, "black");
            board = placePiece(board, 1, 3, "white");
            board = placePiece(board, 1, 4, "white");
            board = placePiece(board, 0, 5, "white");
            board = placePiece(board, 0, 2, "white");
            const result = checkCaptures(board, 0, 2, "white");
            assert.strictEqual(result[0][3].piece, null);
            assert.strictEqual(result[0][4].piece, null);
        });

        it("no capture if inward piece is missing", function () {
            let board = emptyBoard();
            board = placePiece(board, 0, 3, "black");
            board = placePiece(board, 0, 4, "black");
            board = placePiece(board, 1, 3, "white");
            board = placePiece(board, 0, 5, "white");
            board = placePiece(board, 0, 2, "white");
            const result = checkCaptures(board, 0, 2, "white");
            assert.strictEqual(result[0][3].piece, "black");
        });

        it("does not capture the king in a shieldwall", function () {
            let board = emptyBoard();
            board = placePiece(board, 0, 3, "black");
            board = placePiece(board, 0, 4, "king");
            board = placePiece(board, 1, 3, "white");
            board = placePiece(board, 1, 4, "white");
            board = placePiece(board, 0, 5, "white");
            board = placePiece(board, 0, 2, "white");
            const result = checkCaptures(board, 0, 2, "white");
            assert.strictEqual(result[0][3].piece, null);
            assert.strictEqual(result[0][4].piece, "king");
        });
    });

    describe("capture properties", function () {

        it("never increases total piece count", function () {
            fc.assert(fc.property(
                fc.integer({min: 0, max: 10}),
                fc.integer({min: 0, max: 10}),
                function (row, col) {
                    const board = createGame().board;
                    const before = (
                        countPieces(board, "black")
                        + countPieces(board, "white")
                        + countPieces(board, "king")
                    );
                    const result = checkCaptures(board, row, col, "black");
                    const after = (
                        countPieces(result, "black")
                        + countPieces(result, "white")
                        + countPieces(result, "king")
                    );
                    return after <= before;
                }
            ));
        });

        it("never mutates the original board", function () {
            fc.assert(fc.property(
                fc.integer({min: 0, max: 10}),
                fc.integer({min: 0, max: 10}),
                function (row, col) {
                    const board = createGame().board;
                    const snapshot = boardToString(board);
                    checkCaptures(board, row, col, "black");
                    return boardToString(board) === snapshot;
                }
            ));
        });
    });
});

describe("checkWinCondition", function () {

    it("returns playing on a fresh board", function () {
        const game = createGame();
        assert.strictEqual(
            checkWinCondition(game.board, "black", []),
            "playing"
        );
    });

    it("white wins when king reaches top-left corner", function () {
        let board = emptyBoard();
        board = placePiece(board, 0, 0, "king");
        assert.strictEqual(
            checkWinCondition(board, "white", []),
            "white_wins_corner"
        );
    });

    it("white wins when king reaches top-right corner", function () {
        let board = emptyBoard();
        board = placePiece(board, 0, 10, "king");
        assert.strictEqual(
            checkWinCondition(board, "white", []),
            "white_wins_corner"
        );
    });

    it("white wins when king reaches bottom-left corner", function () {
        let board = emptyBoard();
        board = placePiece(board, 10, 0, "king");
        assert.strictEqual(
            checkWinCondition(board, "white", []),
            "white_wins_corner"
        );
    });

    it("white wins when king reaches bottom-right corner", function () {
        let board = emptyBoard();
        board = placePiece(board, 10, 10, "king");
        assert.strictEqual(
            checkWinCondition(board, "white", []),
            "white_wins_corner"
        );
    });

    it("black wins when king is absent from board", function () {
        let board = createGame().board;
        board = removePiece(board, 5, 5);
        assert.strictEqual(
            checkWinCondition(board, "black", []),
            "black_wins_capture"
        );
    });

    it("returns black_wins_repetition with 3 occurrences", function () {
        const game = createGame();
        const position = boardToString(game.board);
        const history = [position, position, position];
        assert.strictEqual(
            checkWinCondition(game.board, "white", history),
            "black_wins_repetition"
        );
    });

    it("does not trigger repetition with only 2 occurrences", function () {
        const game = createGame();
        const position = boardToString(game.board);
        const history = [position, position];
        assert.strictEqual(
            checkWinCondition(game.board, "white", history),
            "playing"
        );
    });

    it("returns black_wins_encirclement when white is surrounded", function () {
        let board = emptyBoard();
        board = placePiece(board, 5, 5, "king");
        board = placePiece(board, 5, 4, "white");
        board = placePiece(board, 5, 6, "white");
        board = placePiece(board, 4, 5, "white");
        board = placePiece(board, 6, 5, "white");
        board = placePiece(board, 3, 5, "black");
        board = placePiece(board, 7, 5, "black");
        board = placePiece(board, 5, 3, "black");
        board = placePiece(board, 5, 7, "black");
        board = placePiece(board, 4, 4, "black");
        board = placePiece(board, 4, 6, "black");
        board = placePiece(board, 6, 4, "black");
        board = placePiece(board, 6, 6, "black");
        assert.strictEqual(
            checkWinCondition(board, "black", []),
            "black_wins_encirclement"
        );
    });

    it(
        "returns white_wins_exitfort when king has exit fort on edge",
        function () {
            let board = emptyBoard();
            board = placePiece(board, 0, 5, "king");
            board = placePiece(board, 0, 3, "white");
            board = placePiece(board, 1, 3, "white");
            board = placePiece(board, 1, 4, "white");
            board = placePiece(board, 1, 5, "white");
            board = placePiece(board, 1, 6, "white");
            board = placePiece(board, 0, 6, "white");
            assert.strictEqual(
                checkWinCondition(board, "white", []),
                "white_wins_exitfort"
            );
        }
    );

    it("does not mutate the board", function () {
        fc.assert(fc.property(
            fc.constantFrom("black", "white"),
            function (turn) {
                const board = createGame().board;
                const snapshot = boardToString(board);
                checkWinCondition(board, turn, []);
                return boardToString(board) === snapshot;
            }
        ));
    });
});

describe("switchTurn", function () {

    it("returns white when given black", function () {
        assert.strictEqual(switchTurn("black"), "white");
    });

    it("returns black when given white", function () {
        assert.strictEqual(switchTurn("white"), "black");
    });
});

describe("boardToString", function () {

    it("always returns a string of length 121", function () {
        const board = createGame().board;
        assert.strictEqual(boardToString(board).length, 121);
    });

    it("only contains the characters B W K and .", function () {
        const board = createGame().board;
        const valid = boardToString(board).split("").every(
            function (ch) {
                return (
                    ch === "B"
                    || ch === "W"
                    || ch === "K"
                    || ch === "."
                );
            }
        );
        assert.strictEqual(valid, true);
    });

    it("same board produces same string when called twice", function () {
        const board = createGame().board;
        assert.strictEqual(
            boardToString(board),
            boardToString(board)
        );
    });

    it("different boards produce different strings", function () {
        const board1 = createGame().board;
        const board2 = movePiece(board1, 0, 3, 2, 3);
        assert.notStrictEqual(
            boardToString(board1),
            boardToString(board2)
        );
    });

    it("string length is consistent across random valid moves", function () {
        fc.assert(fc.property(
            fc.integer({min: 0, max: 10}),
            fc.integer({min: 0, max: 10}),
            function (row, col) {
                const board = createGame().board;
                if (board[row][col].piece === null) {
                    return true;
                }
                const moves = getLegalMoves(board, row, col);
                if (moves.length === 0) {
                    return true;
                }
                const move = moves[0];
                const newBoard = movePiece(board, row, col, move[0], move[1]);
                return boardToString(newBoard).length === 121;
            }
        ));
    });
});
