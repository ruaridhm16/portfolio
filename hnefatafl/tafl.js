/**
 * @module tafl
 * @description Game logic for Hnefatafl (Copenhagen rules).
 * Pure functions only, no side effects and no DOM access.
 */

/**
 * @typedef {Object} Cell
 * @property {string} terrain - The permanent terrain type of the cell
 * @property {string|null} piece - The piece occupying the cell
 */

/**
 * @typedef {Array<Array<Cell>>} Board
 * The 11x11 grid of cells that makes up the board.
 */

/**
 * @typedef {Object} GameState
 * @property {Board} board - The current board
 * @property {string} turn - Whose turn it is: "black" or "white"
 * @property {Array<Object>} history - One entry per move played,
 *     used to drive the replay screen
 * @property {Array<string>} positionHistory - Board strings for
 *     repetition detection
 * @property {string} status - "playing", "black_wins_capture",
 *     "black_wins_encirclement", "black_wins_repetition",
 *     "white_wins_corner", or "white_wins_exitfort"
 * @property {Array<{row: number, col: number, piece: string}>} [captures] -
 *     Captures from the most recent move, set by makeMove
 */

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

/**
 * Builds a single board cell from a terrain type and a piece.
 * @param {string} terrain - The permanent terrain type of the cell
 * @param {string|null} piece - The piece currently occupying the cell
 * @returns {Cell}
 */
const makeCell = function (terrain, piece) {
    return {piece, terrain};
};

/**
 * Returns true if the given position lies within the 11x11 board.
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @returns {boolean}
 */
const isInBounds = function (row, col) {
    return row >= 0 && row <= 10 && col >= 0 && col <= 10;
};

/**
 * True if (row, col) is one of the four corner squares.
 * @param {number} row - Row index (0-10)
 * @param {number} col - Column index (0-10)
 * @returns {boolean}
 */
const isCorner = function (row, col) {
    return CORNERS.some(function (pos) {
        return pos[0] === row && pos[1] === col;
    });
};

/**
 * True if (row, col) is the throne square at the centre of the board.
 * @param {number} row - Row index (0-10)
 * @param {number} col - Column index (0-10)
 * @returns {boolean}
 */
const isThrone = function (row, col) {
    return THRONE[0] === row && THRONE[1] === col;
};

/**
 * True if (row, col) is one of the attacker's starting squares.
 * @param {number} row - Row index (0-10)
 * @param {number} col - Column index (0-10)
 * @returns {boolean}
 */
const isBlackStart = function (row, col) {
    return BLACK_START.some(function (pos) {
        return pos[0] === row && pos[1] === col;
    });
};

/**
 * True if (row, col) is one of the defender's straight starting
 * squares (the four squares next to the throne).
 * @param {number} row - Row index (0-10)
 * @param {number} col - Column index (0-10)
 * @returns {boolean}
 */
const isWhiteStart = function (row, col) {
    return WHITE_START.some(function (pos) {
        return pos[0] === row && pos[1] === col;
    });
};

/**
 * True if (row, col) is one of the defender's diagonal starting
 * squares (the four squares diagonally next to the throne).
 * @param {number} row - Row index (0-10)
 * @param {number} col - Column index (0-10)
 * @returns {boolean}
 */
const isWhiteDiagonalStart = function (row, col) {
    return WHITE_DIAGONAL_START.some(function (pos) {
        return pos[0] === row && pos[1] === col;
    });
};

/**
 * Returns every square a piece at (row, col) can slide to in a
 * straight line, stopping at the first piece or restricted square
 * in each direction.
 * @param {Board} board - The current board
 * @param {number} row - Row index of the piece (0-10)
 * @param {number} col - Column index of the piece (0-10)
 * @returns {Array<Array<number>>} Array of [row, col] positions
 */
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

/**
 * Returns an array of integers from 0 to n-1.
 * @param {number} n - The length of the range
 * @returns {Array<number>}
 */
const makeRange = function (n) {
    return Object.keys(Array.apply(null, {length: n})).map(
        function (key) {
            return Number(key);
        }
    );
};

/**
 * Creates the starting board, with every piece in its setup position.
 * @returns {Board}
 */
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

/**
 * Serialises a board to a compact string for position comparison.
 * B = black, W = white, K = king, . = empty.
 * Exported for unit testing only.
 * @private
 * @param {Board} board - The board to serialise
 * @returns {string} 121-character position key
 */
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

/**
 * Creates the initial game state.
 * @returns {GameState}
 */
const createGame = function () {
    return {
        board: createBoard(),
        history: [],
        positionHistory: [],
        status: "playing",
        turn: "black"
    };
};

/**
 * Moves a piece from one position to another, returning a new board.
 * @private
 * @param {Board} board - The current board
 * @param {number} fromRow - Row index of the piece to move
 * @param {number} fromCol - Column index of the piece to move
 * @param {number} toRow - Row index of the destination
 * @param {number} toCol - Column index of the destination
 * @returns {Board} New board with the piece moved
 */
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

/**
 * Returns the opposite turn.
 * @private
 * @param {string} turn - The current turn ("black" or "white")
 * @returns {string} The next turn
 */
const switchTurn = function (turn) {
    return (
        turn === "black"
        ? "white"
        : "black"
    );
};

/**
 * Returns true if piece belongs to the player whose turn it is,
 * i.e. whether they're allowed to select and move it.
 * @param {string|null} piece - The piece type
 * @param {string} turn - "black" or "white"
 * @returns {boolean}
 */
const isAllyPiece = function (piece, turn) {
    if (turn === "black") {
        return piece === PIECE.BLACK;
    }
    return piece === PIECE.WHITE || piece === PIECE.KING;
};

/**
 * Returns true if piece belongs to the opposite side from turn.
 * Includes the king as an enemy of black (used in shieldwall).
 * @param {string|null} piece - The piece type
 * @param {string} turn - "black" or "white"
 * @returns {boolean}
 */
const isEnemyPiece = function (piece, turn) {
    if (piece === PIECE.EMPTY) {
        return false;
    }
    return !isAllyPiece(piece, turn);
};

/**
 * Returns true if piece is a capturable enemy (excludes king).
 * @param {string|null} piece - The piece type
 * @param {string} turn - "black" or "white"
 * @returns {boolean}
 */
const isCapturable = function (piece, turn) {
    return isEnemyPiece(piece, turn) && piece !== PIECE.KING;
};

/**
 * Returns true if the square at (row, col) is hostile to targetPiece
 * for a sandwich capture.
 * Corners are always hostile. Throne is always hostile to black;
 * hostile to white only when empty.
 * @param {Board} board - The current board
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {string|null} targetPiece - The piece being captured
 * @returns {boolean}
 */
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

/**
 * Returns a new board with the piece at (row, col) removed.
 * @param {Board} board - The current board
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @returns {Board} New board with piece removed
 */
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

/**
 * Checks standard sandwich captures in all 4 directions from the
 * square the moving piece just landed on. A neighbour is captured
 * if it is sandwiched between the mover and an ally piece or a
 * hostile square on the opposite side. The king is excluded here.
 * @param {Board} board - Board after the move
 * @param {number} toRow - Destination row of the moved piece
 * @param {number} toCol - Destination column of the moved piece
 * @param {string} turn - The side that just moved
 * @returns {Board} New board with captures applied
 */
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

/**
 * Finds the king's position on the board.
 * @param {Board} board - The current board
 * @returns {Array|null} [row, col] or null if not found
 */
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

/**
 * Returns true if the square at (row, col) counts as a side closing
 * in on the king for capture: a black piece, a corner, or the throne.
 * The throne always counts (even when occupied), because it acts as
 * an extra hostile side whenever the king stands next to it.
 * @param {Board} board - The current board
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @returns {boolean}
 */
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

/**
 * Checks if the king is surrounded on all 4 sides by black pieces
 * or hostile squares, and removes him if so. The king cannot be
 * captured on the board edge.
 * @param {Board} board - The current board
 * @returns {Board} New board with king removed if captured
 */
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

/**
 * Finds contiguous groups of enemy pieces in a row of cells.
 * Returns an array of groups, each group being an array of
 * indices into the row where enemy pieces sit.
 * @param {Array<Cell>} cells - A row or column of cells
 * @param {string} turn - The attacking side
 * @returns {Array<Array<number>>} Array of index groups
 */
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

/**
 * Removes enemy pieces from a valid shieldwall group on a
 * horizontal edge. King pieces are never removed.
 * @param {Board} board - The current board
 * @param {Array<number>} group - Indices of the group
 * @param {number} edgeR - Edge row (0 or 10)
 * @param {number} inR - Inward row (1 or 9)
 * @param {string} turn - The attacking side
 * @returns {Board} New board with captures applied
 */
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

/**
 * Removes enemy pieces from a valid shieldwall group on a
 * vertical edge. King pieces are never removed.
 * @param {Board} board - The current board
 * @param {Array<number>} group - Indices of the group
 * @param {number} edgeC - Edge column (0 or 10)
 * @param {number} inC - Inward column (1 or 9)
 * @param {string} turn - The attacking side
 * @returns {Board} New board with captures applied
 */
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

/**
 * Applies shieldwall captures along one horizontal board edge.
 * @param {Board} board - The current board
 * @param {number} edgeR - The edge row (0 or 10)
 * @param {number} inR - The inward row (1 or 9)
 * @param {string} turn - The side that just moved (the attacker)
 * @returns {Board} New board with shieldwall captures applied
 */
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

/**
 * Applies shieldwall captures along one vertical board edge.
 * @param {Board} board - The current board
 * @param {number} edgeC - The edge column (0 or 10)
 * @param {number} inC - The inward column (1 or 9)
 * @param {string} turn - The side that just moved (the attacker)
 * @returns {Board} New board with shieldwall captures applied
 */
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

/**
 * Checks all four board edges for shieldwall captures.
 * @param {Board} board - The current board
 * @param {string} turn - The side that just moved (the attacker)
 * @returns {Board} New board with all shieldwall captures applied
 */
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

/**
 * Checks all captures triggered by moving a piece to (toRow, toCol).
 * Applies standard sandwich captures, shieldwall captures, and (on
 * black's turn) king capture. Returns a new board with all captured
 * pieces removed.
 * @private
 * @param {Board} board - Board after the move
 * @param {number} toRow - Destination row of the moved piece
 * @param {number} toCol - Destination column of the moved piece
 * @param {string} turn - The side that just moved ("black" or "white")
 * @returns {Board} New board with all captures applied
 */
const checkCaptures = function (board, toRow, toCol, turn) {
    let result = checkStandardCaptures(board, toRow, toCol, turn);
    result = checkShieldwallCaptures(result, turn);
    if (turn === "black") {
        result = checkKingCapture(result);
    }
    return result;
};

/**
 * Finds every empty square connected to (row, col) without crossing
 * a piece. Returns the visited set with any newly found squares
 * appended; the original array is never mutated.
 * @param {Board} board - The current board
 * @param {Array<number>} visited - Cell keys already visited
 * @param {number} row - Current row
 * @param {number} col - Current column
 * @returns {Array<number>} Updated visited array
 */
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

/**
 * Returns true if all white and king pieces are completely enclosed
 * by black pieces with no empty square reachable from the board edge.
 * @param {Board} board - The current board
 * @returns {boolean}
 */
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

/**
 * Finds empty squares reachable from (row, col) without crossing a
 * piece, except the seed square (kr, kc), which is included even
 * though the king stands there. Any other occupied square, attacker
 * or defender, blocks the search the same way.
 * @param {Board} board - The current board
 * @param {Array<number>} visited - Cell keys already visited
 * @param {number} row - Current row
 * @param {number} col - Current column
 * @param {number} kr - King's row, the seed of the search
 * @param {number} kc - King's column, the seed of the search
 * @returns {Array<number>} Updated visited array
 */
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

/**
 * Returns true if the exit fort win condition is met: the king
 * stands on the board edge, has at least one legal move, and the
 * open space around it, walled in by its own defenders, cannot be
 * reached by any attacker in a single move.
 * @param {Board} board - The current board
 * @returns {boolean}
 */
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

/**
 * Checks the current win condition after a move and capture
 * resolution. Returns a specific status string encoding the winner
 * and the reason, or "playing" if the game continues.
 * @private
 * @param {Board} board - The current board
 * @param {string} turn - The side that just moved
 * @param {Array<string>} positionHistory - All board strings so far
 * @returns {string} "playing", "white_wins_corner",
 *     "white_wins_exitfort", "black_wins_capture",
 *     "black_wins_encirclement", or "black_wins_repetition"
 */
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

/**
 * Plays a full turn: moves the piece, applies any captures, checks
 * the win condition, and switches turns.
 * @param {GameState} game - The current game state
 * @param {number} fromRow - Row index of the piece to move
 * @param {number} fromCol - Column index of the piece to move
 * @param {number} toRow - Row index of the destination
 * @param {number} toCol - Column index of the destination
 * @returns {GameState} New game state, with this move's captures
 *     attached for the UI to animate
 */
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

/**
 * Returns all positions of pieces belonging to the given side.
 * @param {Board} board - The current board
 * @param {string} side - "black" or "white"
 * @returns {Array<{row: number, col: number, piece: string}>}
 *     Array of positions with their piece type
 */
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

/**
 * Returns true if moving the piece at (fromRow, fromCol) to
 * (toRow, toCol) is a legal move in the current game state.
 * @param {GameState} game - The current game state
 * @param {number} fromRow - Row index of the piece to move
 * @param {number} fromCol - Column index of the piece to move
 * @param {number} toRow - Row index of the destination
 * @param {number} toCol - Column index of the destination
 * @returns {boolean}
 */
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