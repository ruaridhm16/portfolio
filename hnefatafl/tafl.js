
const TERRAIN = Object.freeze({
    BLACK: "black",
    CORNER: "corner",
    NORMAL: "normal",
    THRONE: "throne",
    WHITE: "white",
    WHITE_DIAGONAL: "white-diagonal"
});

const PIECE = Object.freeze({
    BLACK: "black",
    EMPTY: null,
    KING: "king",
    WHITE: "white"
});

const CORNERS = [[0, 0], [0, 10], [10, 0], [10, 10]];
const THRONE = [5, 5];
const ORTHOGONAL_DIRECTIONS = Object.freeze(
    [[-1, 0], [1, 0], [0, -1], [0, 1]]
);

const BLACK_START = [
    [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [1, 5],
    [10, 3], [10, 4], [10, 5], [10, 6], [10, 7], [9, 5],
    [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [5, 1],
    [3, 10], [4, 10], [5, 10], [6, 10], [7, 10], [5, 9]
];

const WHITE_START = [
    [3, 5], [4, 5], [6, 5], [7, 5],
    [5, 3], [5, 4], [5, 6], [5, 7]
];

const WHITE_DIAGONAL_START = [
    [4, 4], [4, 6], [6, 4], [6, 6]
];

const makeCell = function (terrain, piece) {
    return {piece, terrain};
};

const isInBounds = function (row, col) {
    return row >= 0 && row <= 10 && col >= 0 && col <= 10;
};

const isCorner = function (row, col) {
    return CORNERS.some(function (pos) {
        return pos[0] === row && pos[1] === col;
    });
};

const isThrone = function (row, col) {
    return THRONE[0] === row && THRONE[1] === col;
};

const isBlackStart = function (row, col) {
    return BLACK_START.some(function (pos) {
        return pos[0] === row && pos[1] === col;
    });
};

const isWhiteStart = function (row, col) {
    return WHITE_START.some(function (pos) {
        return pos[0] === row && pos[1] === col;
    });
};

const isWhiteDiagonalStart = function (row, col) {
    return WHITE_DIAGONAL_START.some(function (pos) {
        return pos[0] === row && pos[1] === col;
    });
};

const getLegalMoves = function (board, row, col) {
    const piece = board[row][col].piece;
    const directions = ORTHOGONAL_DIRECTIONS;

    const scanDir = function (r, c, acc, dir) {
        if (!isInBounds(r, c)) {
            return acc;
        }
        if (board[r][c].piece !== null) {
            return acc;
        }
        const terrain = board[r][c].terrain;
        if (terrain === TERRAIN.CORNER && piece !== PIECE.KING) {
            return acc;
        }
        const nextAcc = (
            (terrain !== TERRAIN.THRONE || piece === PIECE.KING)
            ? acc.concat([[r, c]])
            : acc
        );
        return scanDir(r + dir[0], c + dir[1], nextAcc, dir);
    };

    return directions.reduce(function (allMoves, dir) {
        return allMoves.concat(
            scanDir(row + dir[0], col + dir[1], [], dir)
        );
    }, []);
};

const makeRange = function (n) {
    return Object.keys(Array.apply(null, {length: n})).map(
        function (key) {
            return Number(key);
        }
    );
};

const createBoard = function () {
    return makeRange(11).map(function (row) {
        return makeRange(11).map(function (col) {
            const terrain = (
                isCorner(row, col)
                ? TERRAIN.CORNER
                : isThrone(row, col)
                ? TERRAIN.THRONE
                : isBlackStart(row, col)
                ? TERRAIN.BLACK
                : isWhiteDiagonalStart(row, col)
                ? TERRAIN.WHITE_DIAGONAL
                : isWhiteStart(row, col)
                ? TERRAIN.WHITE
                : TERRAIN.NORMAL
            );
            const piece = (
                isThrone(row, col)
                ? PIECE.KING
                : isBlackStart(row, col)
                ? PIECE.BLACK
                : (
                    isWhiteStart(row, col)
                    || isWhiteDiagonalStart(row, col)
                )
                ? PIECE.WHITE
                : PIECE.EMPTY
            );
            return makeCell(terrain, piece);
        });
    });
};

const boardToString = function (board) {
    return board.map(function (row) {
        return row.map(function (cell) {
            if (cell.piece === "black") {
                return "B";
            }
            if (cell.piece === "white") {
                return "W";
            }
            if (cell.piece === "king") {
                return "K";
            }
            return ".";
        }).join("");
    }).join("");
};

const createGame = function () {
    return {
        board: createBoard(),
        history: [],
        positionHistory: [],
        status: "playing",
        turn: "black"
    };
};

const movePiece = function (board, fromRow, fromCol, toRow, toCol) {
    const piece = board[fromRow][fromCol].piece;
    return board.map(function (row, r) {
        return row.map(function (cell, c) {
            if (r === fromRow && c === fromCol) {
                return makeCell(cell.terrain, PIECE.EMPTY);
            }
            if (r === toRow && c === toCol) {
                return makeCell(cell.terrain, piece);
            }
            return cell;
        });
    });
};

const switchTurn = function (turn) {
    return (
        turn === "black"
        ? "white"
        : "black"
    );
};

const isAllyPiece = function (piece, turn) {
    if (turn === "black") {
        return piece === PIECE.BLACK;
    }
    return piece === PIECE.WHITE || piece === PIECE.KING;
};

const isEnemyPiece = function (piece, turn) {
    if (piece === PIECE.EMPTY) {
        return false;
    }
    return !isAllyPiece(piece, turn);
};

const isCapturable = function (piece, turn) {
    return isEnemyPiece(piece, turn) && piece !== PIECE.KING;
};

const isHostileTo = function (board, row, col, targetPiece) {
    if (isCorner(row, col)) {
        return true;
    }
    if (isThrone(row, col)) {
        if (targetPiece === PIECE.BLACK) {
            return true;
        }
        return board[row][col].piece === PIECE.EMPTY;
    }
    return false;
};

const removePieceAt = function (board, row, col) {
    return board.map(function (rowArr, r) {
        return rowArr.map(function (cell, c) {
            if (r === row && c === col) {
                return makeCell(cell.terrain, PIECE.EMPTY);
            }
            return cell;
        });
    });
};

const checkStandardCaptures = function (board, toRow, toCol, turn) {
    const dirs = ORTHOGONAL_DIRECTIONS;
    return dirs.reduce(function (currentBoard, dir) {
        const nr = toRow + dir[0];
        const nc = toCol + dir[1];
        if (!isInBounds(nr, nc)) {
            return currentBoard;
        }
        const neighbor = currentBoard[nr][nc].piece;
        if (!isCapturable(neighbor, turn)) {
            return currentBoard;
        }
        const ar = nr + dir[0];
        const ac = nc + dir[1];
        const farInBounds = isInBounds(ar, ac);
        const anvilAllied = (
            farInBounds
            ? isAllyPiece(currentBoard[ar][ac].piece, turn)
            : false
        );
        const anvilHostile = isHostileTo(
            currentBoard,
            ar,
            ac,
            neighbor
        );
        if (anvilAllied || anvilHostile) {
            return removePieceAt(currentBoard, nr, nc);
        }
        return currentBoard;
    }, board);
};

const findKing = function (board) {
    return board.reduce(function (found, rowArr, r) {
        return rowArr.reduce(function (inner, cell, c) {
            if (cell.piece === PIECE.KING) {
                return [r, c];
            }
            return inner;
        }, found);
    }, null);
};

const isKingCaptureSide = function (board, row, col) {
    if (!isInBounds(row, col)) {
        return false;
    }
    if (isCorner(row, col)) {
        return true;
    }
    if (isThrone(row, col)) {
        return true;
    }
    return board[row][col].piece === PIECE.BLACK;
};

const checkKingCapture = function (board) {
    const pos = findKing(board);
    if (pos === null) {
        return board;
    }
    const kr = pos[0];
    const kc = pos[1];

    if (kr === 0 || kr === 10 || kc === 0 || kc === 10) {
        return board;
    }

    const dirs = ORTHOGONAL_DIRECTIONS;
    const surrounded = dirs.every(function (dir) {
        return isKingCaptureSide(board, kr + dir[0], kc + dir[1]);
    });

    if (surrounded) {
        return removePieceAt(board, kr, kc);
    }
    return board;
};

const findShieldwallGroups = function (cells, turn) {
    return cells.reduce(function (groups, cell, i) {
        if (!isEnemyPiece(cell.piece, turn)) {
            return groups;
        }
        if (groups.length > 0) {
            const lastGroup = groups[groups.length - 1];
            const lastIndex = lastGroup[lastGroup.length - 1];
            if (lastIndex === i - 1) {
                const last = lastGroup.concat([i]);
                return groups.slice(
                    0,
                    groups.length - 1
                ).concat([last]);
            }
        }
        return groups.concat([[i]]);
    }, []);
};

const captureHorizontalGroup = function (board, group, edgeR, inR, turn) {
    if (group.length < 2) {
        return board;
    }
    const first = group[0];
    const last = group[group.length - 1];
    const inwardOk = group.every(function (c) {
        return isAllyPiece(board[inR][c].piece, turn);
    });
    const leftOk = (
        first > 0
        && (
            isAllyPiece(board[edgeR][first - 1].piece, turn)
            || isCorner(edgeR, first - 1)
        )
    );
    const rightOk = (
        last < 10
        && (
            isAllyPiece(board[edgeR][last + 1].piece, turn)
            || isCorner(edgeR, last + 1)
        )
    );
    if (!inwardOk || !leftOk || !rightOk) {
        return board;
    }
    return group.reduce(function (currentBoard, c) {
        if (currentBoard[edgeR][c].piece === PIECE.KING) {
            return currentBoard;
        }
        return removePieceAt(currentBoard, edgeR, c);
    }, board);
};

const captureVerticalGroup = function (board, group, edgeC, inC, turn) {
    if (group.length < 2) {
        return board;
    }
    const first = group[0];
    const last = group[group.length - 1];
    const inwardOk = group.every(function (r) {
        return isAllyPiece(board[r][inC].piece, turn);
    });
    const topOk = (
        first > 0
        && (
            isAllyPiece(board[first - 1][edgeC].piece, turn)
            || isCorner(first - 1, edgeC)
        )
    );
    const botOk = (
        last < 10
        && (
            isAllyPiece(board[last + 1][edgeC].piece, turn)
            || isCorner(last + 1, edgeC)
        )
    );
    if (!inwardOk || !topOk || !botOk) {
        return board;
    }
    return group.reduce(function (currentBoard, r) {
        if (currentBoard[r][edgeC].piece === PIECE.KING) {
            return currentBoard;
        }
        return removePieceAt(currentBoard, r, edgeC);
    }, board);
};

const checkHorizontalShieldwall = function (board, edgeR, inR, turn) {
    const edgeRow = board[edgeR];
    const groups = findShieldwallGroups(edgeRow, turn);
    return groups.reduce(function (currentBoard, group) {
        return captureHorizontalGroup(
            currentBoard,
            group,
            edgeR,
            inR,
            turn
        );
    }, board);
};

const checkVerticalShieldwall = function (board, edgeC, inC, turn) {
    const edgeCol = board.map(function (row) {
        return row[edgeC];
    });
    const groups = findShieldwallGroups(edgeCol, turn);
    return groups.reduce(function (currentBoard, group) {
        return captureVerticalGroup(
            currentBoard,
            group,
            edgeC,
            inC,
            turn
        );
    }, board);
};

const checkShieldwallCaptures = function (board, turn) {
    const edges = [
        {edge: 0, horizontal: true, inward: 1},
        {edge: 10, horizontal: true, inward: 9},
        {edge: 0, horizontal: false, inward: 1},
        {edge: 10, horizontal: false, inward: 9}
    ];
    return edges.reduce(function (currentBoard, config) {
        if (config.horizontal) {
            return checkHorizontalShieldwall(
                currentBoard,
                config.edge,
                config.inward,
                turn
            );
        }
        return checkVerticalShieldwall(
            currentBoard,
            config.edge,
            config.inward,
            turn
        );
    }, board);
};

const checkCaptures = function (board, toRow, toCol, turn) {
    let result = checkStandardCaptures(board, toRow, toCol, turn);
    result = checkShieldwallCaptures(result, turn);
    if (turn === "black") {
        result = checkKingCapture(result);
    }
    return result;
};

const floodFillReachable = function (board, visited, row, col) {
    if (!isInBounds(row, col)) {
        return visited;
    }
    const key = row * 11 + col;
    if (visited.indexOf(key) !== -1) {
        return visited;
    }
    if (board[row][col].piece !== null) {
        return visited;
    }
    const next = visited.concat([key]);
    const v1 = floodFillReachable(board, next, row - 1, col);
    const v2 = floodFillReachable(board, v1, row + 1, col);
    const v3 = floodFillReachable(board, v2, row, col - 1);
    return floodFillReachable(board, v3, row, col + 1);
};

const isEncircled = function (board) {
    const edgeIndices = makeRange(11);
    const visited = edgeIndices.reduce(
        function (acc, i) {
            const v1 = floodFillReachable(board, acc, 0, i);
            const v2 = floodFillReachable(board, v1, 10, i);
            const v3 = floodFillReachable(board, v2, i, 0);
            return floodFillReachable(board, v3, i, 10);
        },
        []
    );
    const dirs = ORTHOGONAL_DIRECTIONS;
    return !board.some(function (rowArr, r) {
        return rowArr.some(function (cell, c) {
            if (
                cell.piece !== PIECE.WHITE
                && cell.piece !== PIECE.KING
            ) {
                return false;
            }
            return dirs.some(function (dir) {
                const nr = r + dir[0];
                const nc = c + dir[1];
                if (!isInBounds(nr, nc)) {
                    return false;
                }
                return visited.indexOf(nr * 11 + nc) !== -1;
            });
        });
    });
};

const floodFillRegion = function (board, visited, row, col, kr, kc) {
    if (!isInBounds(row, col)) {
        return visited;
    }
    const key = row * 11 + col;
    if (visited.indexOf(key) !== -1) {
        return visited;
    }
    const isKingStart = (row === kr && col === kc);
    if (board[row][col].piece !== null && !isKingStart) {
        return visited;
    }
    const next = visited.concat([key]);
    const v1 = floodFillRegion(board, next, row - 1, col, kr, kc);
    const v2 = floodFillRegion(board, v1, row + 1, col, kr, kc);
    const v3 = floodFillRegion(board, v2, row, col - 1, kr, kc);
    return floodFillRegion(board, v3, row, col + 1, kr, kc);
};

const isExitFort = function (board) {
    const pos = findKing(board);
    if (pos === null) {
        return false;
    }
    const kr = pos[0];
    const kc = pos[1];
    if (
        kr !== 0 && kr !== 10
        && kc !== 0 && kc !== 10
    ) {
        return false;
    }
    if (getLegalMoves(board, kr, kc).length === 0) {
        return false;
    }
    const region = floodFillRegion(board, [], kr, kc, kr, kc);
    const blackCanEnter = board.some(function (rowArr, r) {
        return rowArr.some(function (cell, c) {
            if (cell.piece !== PIECE.BLACK) {
                return false;
            }
            return getLegalMoves(board, r, c).some(
                function (move) {
                    return (
                        region.indexOf(move[0] * 11 + move[1])
                        !== -1
                    );
                }
            );
        });
    });
    return !blackCanEnter;
};

const checkWinCondition = function (board, turn, positionHistory) {
    const kingPos = findKing(board);
    if (turn === "white") {
        const currentPosition = boardToString(board);
        const repetitions = positionHistory.filter(function (pos) {
            return pos === currentPosition;
        }).length;
        if (repetitions >= 3) {
            return "black_wins_repetition";
        }
        if (
            kingPos !== null
            && isCorner(kingPos[0], kingPos[1])
        ) {
            return "white_wins_corner";
        }
        if (isExitFort(board)) {
            return "white_wins_exitfort";
        }
    }
    if (turn === "black") {
        if (kingPos === null) {
            return "black_wins_capture";
        }
        if (isEncircled(board)) {
            return "black_wins_encirclement";
        }
    }
    return "playing";
};

const makeMove = function (game, fromRow, fromCol, toRow, toCol) {
    const piece = game.board[fromRow][fromCol].piece;
    const boardAfterMove = movePiece(
        game.board,
        fromRow,
        fromCol,
        toRow,
        toCol
    );
    const boardAfterCaptures = checkCaptures(
        boardAfterMove,
        toRow,
        toCol,
        game.turn
    );
    const newPositionHistory = game.positionHistory.concat(
        [boardToString(boardAfterCaptures)]
    );
    const captures = [];
    let r = 0;
    while (r <= 10) {
        let c = 0;
        while (c <= 10) {
            const before = boardAfterMove[r][c].piece;
            const after = boardAfterCaptures[r][c].piece;
            if (before !== null && after === null) {
                captures.push({col: c, piece: before, row: r});
            }
            c += 1;
        }
        r += 1;
    }
    const newHistory = game.history.concat([{
        boardSnapshot: boardAfterCaptures,
        captures,
        from: {col: fromCol, row: fromRow},
        piece,
        to: {col: toCol, row: toRow}
    }]);
    const newStatus = checkWinCondition(
        boardAfterCaptures,
        game.turn,
        newPositionHistory
    );
    const newTurn = (
        newStatus === "playing"
        ? switchTurn(game.turn)
        : game.turn
    );
    return {
        board: boardAfterCaptures,
        captures,
        history: newHistory,
        positionHistory: newPositionHistory,
        status: newStatus,
        turn: newTurn
    };
};

const getPieces = function (board, side) {
    return board.reduce(function (pieces, row, r) {
        return pieces.concat(
            row.reduce(function (rowPieces, cell, c) {
                if (isAllyPiece(cell.piece, side)) {
                    return rowPieces.concat(
                        [{col: c, piece: cell.piece, row: r}]
                    );
                }
                return rowPieces;
            }, [])
        );
    }, []);
};

const isLegalMove = function (game, fromRow, fromCol, toRow, toCol) {
    const moves = getLegalMoves(game.board, fromRow, fromCol);
    return moves.some(function (move) {
        return move[0] === toRow && move[1] === toCol;
    });
};

export {
    boardToString,
    checkCaptures,
    checkWinCondition,
    createGame,
    getLegalMoves,
    getPieces,
    isAllyPiece,
    isInBounds,
    isLegalMove,
    makeMove,
    movePiece,
    switchTurn
};