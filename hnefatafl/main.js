/*jslint browser*/
import {
    createGame,
    getLegalMoves,
    isAllyPiece,
    isInBounds,
    makeMove
} from "./tafl.js";
import {MESSAGES, isBlackStatus, toNotation} from "./messages.js";

let game = createGame();
let selectedCell = null;
let legalMoves = [];
let onCellClick = null;
let pendingCaptures = [];
let turnCount = 0;
let turnIndicator = null;
let labelsRendered = false;
let initialBoard = null;
let replayStep = 0;
let replayInterval = null;
let replayPlaying = false;
let replayLabelsRendered = false;
let currentScreen = "menu";

/**
 * Returns the SVG file path for a given terrain type.
 * @param {string} terrain - The terrain type of the cell
 * @returns {string} Path to the SVG file
 */
const getTerrainSVG = function (terrain) {
    if (terrain === "corner") {
        return "assets/cell-corner.svg";
    }
    if (terrain === "throne") {
        return "assets/cell-throne.svg";
    }
    if (terrain === "black") {
        return "assets/cell-black.svg";
    }
    if (terrain === "white") {
        return "assets/cell-white.svg";
    }
    if (terrain === "white-diagonal") {
        return "assets/cell-white-diagonal.svg";
    }
    return "assets/cell-normal.svg";
};

/**
 * Returns the SVG file path for a given piece type.
 * @param {string} piece - The piece type
 * @returns {string} Path to the SVG file
 */
const getPieceSVG = function (piece) {
    if (piece === "black") {
        return "assets/piece-black.svg";
    }
    if (piece === "white") {
        return "assets/piece-white.svg";
    }
    if (piece === "king") {
        return "assets/piece-king.svg";
    }
    return "";
};

/**
 * Returns the rotation in degrees for a terrain cell based on its position.
 * @param {string} terrain - The terrain type of the cell
 * @param {number} row - Row index (0-10)
 * @param {number} col - Column index (0-10)
 * @returns {number} Rotation in degrees
 */
const getRotation = function (terrain, row, col) {
    if (terrain === "black") {
        if (row === 0 || row === 1) {
            return 180;
        }
        if (row === 9 || row === 10) {
            return 0;
        }
        if (col === 0 || col === 1) {
            return 90;
        }
        if (col === 9 || col === 10) {
            return 270;
        }
    }
    if (terrain === "white") {
        if (row === 3 || row === 4) {
            return 0;
        }
        if (row === 6 || row === 7) {
            return 180;
        }
        if (col === 3 || col === 4) {
            return 270;
        }
        if (col === 6 || col === 7) {
            return 90;
        }
    }
    if (terrain === "white-diagonal") {
        if (row === 4 && col === 4) {
            return 0;
        }
        if (row === 4 && col === 6) {
            return 90;
        }
        if (row === 6 && col === 4) {
            return 270;
        }
        if (row === 6 && col === 6) {
            return 180;
        }
    }
    return 0;
};

/**
 * Creates and appends a new grouped turn block to the log.
 * Returns the block element so lines can be added to it.
 * @param {string} side - "black" or "white"
 * @param {number} turnNumber - The current turn number
 * @returns {Element} The block container element
 */
const createTurnBlock = function (side, turnNumber) {
    const log = document.getElementById("info-board");
    const block = document.createElement("div");
    block.classList.add("log-block");
    const header = document.createElement("div");
    header.classList.add("log-turn-header");
    header.textContent = MESSAGES.turnHeader(side, turnNumber);
    block.appendChild(header);
    log.appendChild(block);
    log.scrollTop = log.scrollHeight;
    return block;
};

/**
 * Appends a move or capture line inside an existing turn block.
 * @param {Element} block - The turn block container
 * @param {string} text - The line text
 */
const appendToBlock = function (block, text) {
    const log = document.getElementById("info-board");
    const entry = document.createElement("div");
    entry.classList.add("log-turn-entry");
    entry.textContent = text;
    block.appendChild(entry);
    log.scrollTop = log.scrollHeight;
};

/**
 * Injects a temporary piece image for each capture into boardElement
 * and animates it shrinking to nothing before removal.
 * @param {Element} boardElement - The board container the captures
 *     happened on (#board or #replay-board)
 * @param {Array<{row: number, col: number, piece: string}>} captures -
 *     The captures to animate
 */
const animateCaptureImages = function (boardElement, captures) {
    captures.forEach(function (capture) {
        const index = capture.row * 11 + capture.col;
        const cellEl = boardElement.children[index];
        const img = document.createElement("img");
        img.src = getPieceSVG(capture.piece);
        img.alt = capture.piece;
        img.classList.add("piece", "piece-captured");
        cellEl.appendChild(img);
        img.addEventListener("transitionend", function () {
            img.remove();
        });
        window.requestAnimationFrame(function () {
            img.style.transform = "scale(0)";
        });
    });
};

/**
 * Animates all pending captures on the live board, then clears them.
 */
const animateCapturedPieces = function () {
    const boardElement = document.getElementById("board");
    animateCaptureImages(boardElement, pendingCaptures);
    pendingCaptures = [];
};

/**
 * Updates page background and label colours to match the current turn.
 */
const updatePageStyle = function () {
    if (game.turn === "black") {
        document.body.classList.remove("white-turn");
        document.body.classList.add("black-turn");
    } else {
        document.body.classList.remove("black-turn");
        document.body.classList.add("white-turn");
    }
    const labelColour = (
        game.turn === "black"
        ? "#F5F0E8"
        : "#242424"
    );
    document.querySelectorAll(".board-label").forEach(
        function (label) {
            label.style.color = labelColour;
        }
    );
};

/**
 * Appends a "whose turn" indicator below the latest log block and
 * stores it so the next move can remove it before logging.
 * @param {string} side - "black" or "white"
 */
const showTurnIndicator = function (side) {
    const log = document.getElementById("info-board");
    const indicator = document.createElement("div");
    indicator.textContent = MESSAGES.turnIndicator(side);
    indicator.classList.add("log-turn-indicator");
    log.appendChild(indicator);
    log.scrollTop = log.scrollHeight;
    turnIndicator = indicator;
};

/**
 * Creates and fades in a full-screen game over overlay.
 * @param {string} status - A GameState status, e.g. "black_wins_capture"
 *     or "white_wins_corner"
 * @param {boolean} [instant] - If true, show the overlay immediately
 *     with no fade-in (used when returning from the replay screen)
 */
const showGameOver = function (status, instant) {
    const isBlack = isBlackStatus(status);
    const bg = (
        isBlack
        ? "#2C2C2C"
        : "#FFF8F1"
    );
    const fg = (
        isBlack
        ? "#FFF8F1"
        : "#2C2C2C"
    );

    const overlay = document.createElement("div");
    overlay.id = "game-over-overlay";
    overlay.setAttribute("role", "alert");
    overlay.setAttribute("aria-live", "assertive");
    overlay.style.backgroundColor = bg;

    const winner = document.createElement("div");
    winner.classList.add("game-over-winner");
    winner.style.color = fg;
    winner.textContent = MESSAGES.winnerHeading(status);

    const sub = document.createElement("div");
    sub.classList.add("game-over-sub");
    sub.style.color = (
        isBlack
        ? "#C9A84C"
        : "#7A5C00"
    );
    sub.textContent = MESSAGES.winReason(status);

    const btnPlayAgain = document.createElement("button");
    btnPlayAgain.id = "btn-play-again";
    btnPlayAgain.classList.add("icon-btn");
    btnPlayAgain.setAttribute("aria-label", "Play again");

    const btnMainMenu = document.createElement("button");
    btnMainMenu.id = "btn-main-menu";
    btnMainMenu.classList.add("icon-btn");
    btnMainMenu.setAttribute("aria-label", "Return to main menu");

    const btnWatchReplay = document.createElement("button");
    btnWatchReplay.id = "btn-watch-replay";
    btnWatchReplay.classList.add("icon-btn");
    btnWatchReplay.setAttribute("aria-label", "Watch replay");

    const gameOverButtons = document.createElement("div");
    gameOverButtons.classList.add("game-over-buttons");
    gameOverButtons.appendChild(btnPlayAgain);
    gameOverButtons.appendChild(btnMainMenu);
    gameOverButtons.appendChild(btnWatchReplay);
    gameOverButtons.style.opacity = "0";
    gameOverButtons.style.transition = "opacity 0.6s";
    gameOverButtons.style.pointerEvents = "none";

    overlay.appendChild(winner);
    overlay.appendChild(sub);
    overlay.appendChild(gameOverButtons);
    document.body.appendChild(overlay);

    if (instant) {
        overlay.style.transition = "none";
        overlay.style.opacity = "1";
        overlay.style.pointerEvents = "auto";
        gameOverButtons.style.transition = "none";
        gameOverButtons.style.opacity = "1";
        gameOverButtons.style.pointerEvents = "auto";
    } else {
        overlay.addEventListener("transitionend", function () {
            overlay.style.pointerEvents = "auto";
        });
        window.setTimeout(function () {
            overlay.style.opacity = "1";
        }, 400);
        window.setTimeout(function () {
            gameOverButtons.style.opacity = "1";
            gameOverButtons.style.pointerEvents = "auto";
        }, 2500);
    }
};

/**
 * Returns true if (rowIndex, colIndex) is one of the currently
 * highlighted legal move targets for the selected piece.
 * @param {number} rowIndex - Row index of the cell
 * @param {number} colIndex - Column index of the cell
 * @returns {boolean}
 */
const isLegalMoveTarget = function (rowIndex, colIndex) {
    return legalMoves.some(function (move) {
        return move[0] === rowIndex && move[1] === colIndex;
    });
};

/**
 * Handles a click on a cell, updating the selected piece in game state.
 * @param {Object} cell - The cell object
 * @param {number} rowIndex - Row index of the cell
 * @param {number} colIndex - Column index of the cell
 */
const handleCellClick = function (cell, rowIndex, colIndex) {

    if (game.status !== "playing") {
        return;
    }

    const isLegalMove = isLegalMoveTarget(rowIndex, colIndex);

    if (selectedCell !== null && isLegalMove) {
        if (turnIndicator !== null) {
            turnIndicator.remove();
            turnIndicator = null;
        }
        const fromRow = selectedCell.row;
        const fromCol = selectedCell.col;
        const movingTurn = game.turn;
        const movingPiece = game.board[fromRow][fromCol].piece;

        game = makeMove(
            game,
            fromRow,
            fromCol,
            rowIndex,
            colIndex
        );
        pendingCaptures = game.captures;

        // log the move
        turnCount += 1;
        const block = createTurnBlock(movingTurn, turnCount);
        appendToBlock(
            block,
            MESSAGES.pieceMoved(
                movingPiece,
                fromRow,
                fromCol,
                rowIndex,
                colIndex
            )
        );
        game.captures.forEach(function (cap) {
            appendToBlock(
                block,
                MESSAGES.pieceCaptured(cap.piece, cap.row, cap.col)
            );
        });

        if (game.status !== "playing") {
            selectedCell = null;
            legalMoves = [];
            appendToBlock(block, MESSAGES.gameOver(game.status));
            const logEl = document.getElementById("info-board");
            const winnerEntry = document.createElement("div");
            winnerEntry.classList.add("log-winner");
            winnerEntry.textContent = "Game Over";
            logEl.appendChild(winnerEntry);
            logEl.scrollTop = logEl.scrollHeight;
            showGameOver(game.status);
            return;
        }

        selectedCell = null;
        legalMoves = [];
        showTurnIndicator(game.turn);

        return;
    }

    if (cell.piece !== null) {

        // can't select the opponent's pieces
        if (!isAllyPiece(cell.piece, game.turn)) {
            return;
        }

        if (
            selectedCell !== null
            && selectedCell.row === rowIndex
            && selectedCell.col === colIndex
        ) {
            selectedCell = null;
            legalMoves = [];
        } else {
            selectedCell = {col: colIndex, row: rowIndex};
            legalMoves = getLegalMoves(
                game.board,
                rowIndex,
                colIndex
            );
        }
    } else {
        selectedCell = null;
        legalMoves = [];
    }
};

/**
 * Creates a cell element with its terrain image, accessible label,
 * and a piece image on top if the cell is occupied. Shared by the
 * live board and the read-only replay board.
 * @param {Object} cell - The cell object
 * @param {number} rowIndex - Row index of the cell
 * @param {number} colIndex - Column index of the cell
 * @returns {Element} The cell element, not yet attached to the DOM
 */
const createCellElement = function (cell, rowIndex, colIndex) {
    const cellElement = document.createElement("div");
    const img = document.createElement("img");

    img.src = getTerrainSVG(cell.terrain);
    img.style.transform = `rotate(${getRotation(
        cell.terrain,
        rowIndex,
        colIndex
    )}deg)`;
    img.alt = cell.terrain;

    cellElement.setAttribute(
        "aria-label",
        toNotation(rowIndex, colIndex)
        + (
            cell.piece !== null
            ? " " + cell.piece
            : ""
        )
    );
    cellElement.classList.add("cell");
    cellElement.appendChild(img);

    if (cell.piece !== null) {
        const pieceImg = document.createElement("img");
        pieceImg.src = getPieceSVG(cell.piece);
        pieceImg.alt = cell.piece;
        pieceImg.classList.add("piece");
        cellElement.appendChild(pieceImg);
    }

    return cellElement;
};

/**
 * Renders the board into the #board element.
 * @param {Array} board - 11x11 array of cell objects
 */
const renderBoard = function (board) {
    const boardElement = document.getElementById("board");
    board.forEach(function (row, rowIndex) {
        row.forEach(function (cell, colIndex) {

            const cellElement = createCellElement(cell, rowIndex, colIndex);

            // accessibility attributes
            cellElement.setAttribute("tabindex", (
                (rowIndex === 0 && colIndex === 0)
                ? "0"
                : "-1"
            ));
            cellElement.setAttribute("role", "button");

            // re-renders via the click callback
            cellElement.addEventListener("click", function () {
                handleCellClick(cell, rowIndex, colIndex);
                if (onCellClick !== null) {
                    onCellClick();
                }
            });

            cellElement.addEventListener("keydown", function (event) {
                if (event.key === "Enter" || event.key === " ") {
                    handleCellClick(cell, rowIndex, colIndex);
                    if (onCellClick !== null) {
                        onCellClick();
                    }
                }
                if (
                    event.key === "ArrowUp"
                    || event.key === "ArrowDown"
                    || event.key === "ArrowLeft"
                    || event.key === "ArrowRight"
                ) {
                    const dRow = (
                        event.key === "ArrowUp"
                        ? -1
                        : (
                            event.key === "ArrowDown"
                            ? 1
                            : 0
                        )
                    );
                    const dCol = (
                        event.key === "ArrowLeft"
                        ? -1
                        : (
                            event.key === "ArrowRight"
                            ? 1
                            : 0
                        )
                    );
                    const targetRow = rowIndex + dRow;
                    const targetCol = colIndex + dCol;
                    if (isInBounds(targetRow, targetCol)) {
                        event.preventDefault();
                        boardElement.children[
                            targetRow * 11 + targetCol
                        ].focus();
                    }
                }
            });

            if (
                cell.piece !== null
                && selectedCell !== null
                && selectedCell.row === rowIndex
                && selectedCell.col === colIndex
            ) {
                const highlightImg = document.createElement("img");
                highlightImg.src = "assets/piece-highlight.svg";
                highlightImg.alt = "selected";
                highlightImg.classList.add("highlight");
                cellElement.appendChild(highlightImg);
            }

            if (isLegalMoveTarget(rowIndex, colIndex)) {
                const moveHighlight = document.createElement("img");
                moveHighlight.src = "assets/cell-highlight.svg";
                moveHighlight.alt = "legal move";
                moveHighlight.classList.add("move-highlight");
                cellElement.appendChild(moveHighlight);
            }

            boardElement.appendChild(cellElement);
        });
    });
};

/**
 * Renders row and column index labels into the given containers.
 * @param {string} rowContainerId - Id of the row-labels container
 * @param {string} colContainerId - Id of the col-labels container
 */
const renderLabelSet = function (rowContainerId, colContainerId) {
    const rowLabels = document.getElementById(rowContainerId);
    const colLabels = document.getElementById(colContainerId);
    const cols = "ABCDEFGHIJK";

    let i = 0;
    while (i < 11) {

        const rowLabel = document.createElement("div");
        rowLabel.textContent = 11 - i;
        rowLabel.classList.add("row-label", "board-label");
        rowLabels.appendChild(rowLabel);

        const colLabel = document.createElement("div");
        colLabel.textContent = cols.charAt(i);
        colLabel.classList.add("col-label", "board-label");
        colLabels.appendChild(colLabel);

        i += 1;
    }
};

/**
 * Renders row and column index labels around the board.
 */
const renderLabels = function () {
    renderLabelSet("row-labels", "col-labels");
};

/**
 * Clears and re-renders the board and info panel.
 */
const render = function () {
    const boardElement = document.getElementById("board");
    boardElement.innerHTML = "";
    renderBoard(game.board);
    updatePageStyle();
};

// wire up the click callback
onCellClick = function () {
    render();
    animateCapturedPieces();
};

/**
 * Resets game state and renders a fresh board. Removes any lingering
 * game-over overlay. Renders labels on the first call only.
 */
const startGame = function () {
    const existing = document.getElementById("game-over-overlay");
    if (existing !== null) {
        existing.remove();
    }
    game = createGame();
    initialBoard = game.board;
    turnCount = 0;
    pendingCaptures = [];
    turnIndicator = null;
    document.getElementById("board").innerHTML = "";
    document.getElementById("info-board").innerHTML = "";
    if (!labelsRendered) {
        renderLabels();
        labelsRendered = true;
    }
    render();
    showTurnIndicator(game.turn);
    const firstCell = document.getElementById("board").children[0];
    if (firstCell !== null) {
        firstCell.focus();
    }
};

/**
 * Fades through a solid colour to switch to a different screen.
 * Sets the overlay background to colour, fades it in, swaps the
 * visible screen, then fades the overlay back out.
 * @param {string} targetScreenId - The id of the screen to show
 * @param {string} colour - CSS colour for the transition flash
 * @param {function} [onSwitch] - Optional callback fired at the
 *     midpoint, while the overlay is opaque and before fade-out
 */
const transitionTo = function (targetScreenId, colour, onSwitch) {
    const overlay = document.getElementById("transition-overlay");
    let fadingIn = true;
    overlay.style.backgroundColor = colour;
    overlay.style.pointerEvents = "auto";

    const handleTransition = function () {
        if (fadingIn) {
            fadingIn = false;
            document.querySelectorAll(".screen").forEach(
                function (s) {
                    s.style.display = "none";
                }
            );
            const target = document.getElementById(targetScreenId);
            const disp = target.getAttribute("data-display");
            target.style.display = (
                disp !== null
                ? disp
                : "block"
            );
            currentScreen = targetScreenId.slice(7);
            const backBtn = document.getElementById("btn-back");
            if (
                targetScreenId === "screen-game"
                || targetScreenId === "screen-replay"
                || targetScreenId === "screen-rulebook"
            ) {
                backBtn.style.display = "block";
            } else {
                backBtn.style.display = "none";
            }
            if (typeof onSwitch === "function") {
                onSwitch();
            }
            overlay.style.opacity = "0";
        } else {
            overlay.removeEventListener(
                "transitionend",
                handleTransition
            );
            overlay.style.pointerEvents = "none";
        }
    };

    overlay.addEventListener("transitionend", handleTransition);
    overlay.style.opacity = "1";
};

/**
 * Renders a board state into #replay-board (view-only, no handlers).
 * @param {Array} board - 11x11 array of cell objects
 */
const renderReplayBoard = function (board) {
    const boardEl = document.getElementById("replay-board");
    board.forEach(function (row, rowIndex) {
        row.forEach(function (cell, colIndex) {
            const cellEl = createCellElement(cell, rowIndex, colIndex);
            cellEl.setAttribute("tabindex", "-1");
            boardEl.appendChild(cellEl);
        });
    });
};

/**
 * Renders row and column labels around the replay board.
 * Only needs to run once per session (guarded by replayLabelsRendered).
 */
const renderReplayLabels = function () {
    renderLabelSet("replay-row-labels", "replay-col-labels");
};

/**
 * Rebuilds the move log in #replay-log up to and including step.
 * @param {number} step - 1-indexed step to render up to (0 clears log)
 */
const renderReplayLog = function (step) {
    const logEl = document.getElementById("replay-log");
    logEl.innerHTML = "";
    const startsEntry = document.createElement("div");
    startsEntry.classList.add("log-turn-header");
    startsEntry.textContent = "Black starts";
    logEl.appendChild(startsEntry);
    if (step === 0) {
        return;
    }
    let s = 1;
    while (s <= step) {
        const entry = game.history[s - 1];
        const side = (
            s % 2 === 1
            ? "black"
            : "white"
        );
        const block = document.createElement("div");
        block.classList.add("log-block");
        const header = document.createElement("div");
        header.classList.add("log-turn-header");
        header.textContent = MESSAGES.turnHeader(side, s);
        block.appendChild(header);
        const moveEntry = document.createElement("div");
        moveEntry.classList.add("log-turn-entry");
        moveEntry.textContent = MESSAGES.pieceMoved(
            entry.piece,
            entry.from.row,
            entry.from.col,
            entry.to.row,
            entry.to.col
        );
        block.appendChild(moveEntry);
        let ci = 0;
        while (ci < entry.captures.length) {
            const cap = entry.captures[ci];
            const capEntry = document.createElement("div");
            capEntry.classList.add("log-turn-entry");
            capEntry.textContent = MESSAGES.pieceCaptured(
                cap.piece,
                cap.row,
                cap.col
            );
            block.appendChild(capEntry);
            ci += 1;
        }
        logEl.appendChild(block);
        s += 1;
    }
    if (step === game.history.length && game.status !== "playing") {
        const winnerEntry = document.createElement("div");
        winnerEntry.classList.add("log-winner");
        winnerEntry.textContent = MESSAGES.gameOver(game.status);
        logEl.appendChild(winnerEntry);
    }
    logEl.scrollTop = logEl.scrollHeight;
};

/**
 * Navigates the replay to a specific step, clamped to valid range.
 * @param {number} step - Target step; 0 shows the initial board state
 * @param {string} direction - "forward" or "backward"
 */
const goToReplayStep = function (step, direction) {
    const len = game.history.length;
    const clamped = Math.max(0, Math.min(step, len));
    replayStep = clamped;
    const board = (
        clamped === 0
        ? initialBoard
        : game.history[clamped - 1].boardSnapshot
    );
    const replayBoardEl = document.getElementById("replay-board");
    replayBoardEl.innerHTML = "";
    renderReplayBoard(board);
    if (direction === "forward" && clamped > 0) {
        const entry = game.history[clamped - 1];
        animateCaptureImages(replayBoardEl, entry.captures);
    }
    const prevBtn = document.getElementById("btn-replay-prev");
    const nextBtn = document.getElementById("btn-replay-next");
    if (clamped === 0) {
        prevBtn.disabled = true;
        prevBtn.style.opacity = "0.35";
    } else {
        prevBtn.disabled = false;
        prevBtn.style.opacity = "1";
    }
    if (clamped >= len) {
        nextBtn.disabled = true;
        nextBtn.style.opacity = "0.35";
    } else {
        nextBtn.disabled = false;
        nextBtn.style.opacity = "1";
    }
    renderReplayLog(clamped);
};

/**
 * Stops autoplay and resets the play/pause button to its play icon.
 */
const pauseReplay = function () {
    if (replayInterval !== null) {
        window.clearInterval(replayInterval);
        replayInterval = null;
    }
    replayPlaying = false;
    const btn = document.getElementById("btn-replay-play-pause");
    btn.style.backgroundImage = "url('assets/button-icon-play.svg')";
};

/**
 * Starts autoplay at one step per second.
 * Clears any existing interval before setting a new one.
 */
const playReplay = function () {
    replayPlaying = true;
    const btn = document.getElementById("btn-replay-play-pause");
    btn.style.backgroundImage = "url('assets/button-icon-pause.svg')";
    if (replayInterval !== null) {
        window.clearInterval(replayInterval);
        replayInterval = null;
    }
    replayInterval = window.setInterval(function () {
        if (replayStep >= game.history.length) {
            pauseReplay();
            return;
        }
        goToReplayStep(replayStep + 1, "forward");
    }, 1000);
};

/**
 * Resets replay state, renders labels once, shows step 0, and
 * transitions to #screen-replay. Colour matches the game winner.
 */
const startReplay = function () {
    replayStep = 0;
    replayPlaying = false;
    if (replayInterval !== null) {
        window.clearInterval(replayInterval);
        replayInterval = null;
    }
    if (!replayLabelsRendered) {
        renderReplayLabels();
        replayLabelsRendered = true;
    }
    goToReplayStep(0, "forward");
    const ppBtn = document.getElementById("btn-replay-play-pause");
    ppBtn.style.backgroundImage = "url('assets/button-icon-play.svg')";
    document.getElementById("btn-back").style.display = "none";
    document.getElementById("screen-game").style.display = "none";
    document.getElementById("board").innerHTML = "";
    transitionTo("screen-replay", "#FFF8F1");
};

/**
 * Shows a confirmation dialog warning that the current game will be
 * lost, with focus trapped between its two buttons. Escape and the
 * No button both dismiss it; Yes dismisses it and calls onConfirm.
 * @param {function} onConfirm - Called if the user confirms
 */
const showConfirmModal = function (onConfirm) {
    const overlay = document.createElement("div");
    overlay.id = "confirm-modal";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Confirm navigation");

    const card = document.createElement("div");
    card.classList.add("confirm-card");

    const msgLine1 = document.createElement("p");
    msgLine1.classList.add("confirm-message");
    msgLine1.textContent = "Are you sure you want to go back?";

    const msgLine2 = document.createElement("p");
    msgLine2.classList.add("confirm-message");
    msgLine2.textContent = "Your game will be lost...";

    const btnYes = document.createElement("button");
    btnYes.id = "btn-confirm-yes";
    btnYes.classList.add("confirm-btn", "icon-btn");
    btnYes.setAttribute("aria-label", "Yes");

    const btnCancel = document.createElement("button");
    btnCancel.id = "btn-confirm-no";
    btnCancel.classList.add("confirm-btn", "icon-btn");
    btnCancel.setAttribute("aria-label", "No");

    const removeModal = function () {
        overlay.remove();
    };

    btnYes.addEventListener("click", function () {
        removeModal();
        onConfirm();
    });

    btnCancel.addEventListener("click", removeModal);

    overlay.addEventListener("keydown", function (evt) {
        const focusable = [btnYes, btnCancel];
        const idx = focusable.indexOf(document.activeElement);
        if (evt.key === "Escape") {
            removeModal();
        } else if (evt.key === "Tab") {
            evt.preventDefault();
            focusable[(
                evt.shiftKey
                ? (idx - 1 + focusable.length) % focusable.length
                : (idx + 1) % focusable.length
            )].focus();
        }
    });

    const btnWrapper = document.createElement("div");
    btnWrapper.classList.add("confirm-buttons");
    btnWrapper.appendChild(btnYes);
    btnWrapper.appendChild(btnCancel);

    card.appendChild(msgLine1);
    card.appendChild(msgLine2);
    card.appendChild(btnWrapper);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    btnCancel.focus();
};

document.getElementById("btn-play").addEventListener(
    "click",
    function () {
        startGame();
        transitionTo("screen-game", "#2C2C2C");
    }
);

document.getElementById("btn-rulebook").addEventListener(
    "click",
    function () {
        transitionTo("screen-rulebook", "#FFF8F1");
    }
);

document.body.addEventListener("click", function (evt) {
    const clickedId = evt.target.id;
    if (clickedId === "btn-play-again") {
        transitionTo("screen-game", "#2C2C2C", startGame);
    }
    if (clickedId === "btn-main-menu") {
        const ov = document.getElementById("game-over-overlay");
        transitionTo("screen-menu", "#FFF8F1", function () {
            if (ov !== null) {
                ov.remove();
            }
        });
    }
    if (clickedId === "btn-watch-replay") {
        const gameOverEl = document.getElementById(
            "game-over-overlay"
        );
        if (gameOverEl !== null) {
            gameOverEl.remove();
        }
        startReplay();
    }
});

document.getElementById("btn-back").addEventListener(
    "click",
    function () {
        if (currentScreen === "rulebook") {
            transitionTo("screen-menu", "#FFF8F1");
            return;
        }
        if (currentScreen === "replay") {
            if (replayPlaying) {
                window.clearInterval(replayInterval);
                replayInterval = null;
                replayPlaying = false;
            }
            document.querySelectorAll(".screen").forEach(
                function (s) {
                    s.style.display = "none";
                }
            );
            const gameScreen = document.getElementById("screen-game");
            gameScreen.style.display = "flex";
            currentScreen = "game";
            showGameOver(game.status, true);
            return;
        }
        const needsConfirm = (
            game.status === "playing" && turnCount > 0
        );
        if (needsConfirm) {
            showConfirmModal(function () {
                const ov = document.getElementById(
                    "game-over-overlay"
                );
                transitionTo("screen-menu", "#FFF8F1", function () {
                    if (ov !== null) {
                        ov.remove();
                    }
                });
            });
            return;
        }
        const ov = document.getElementById("game-over-overlay");
        transitionTo("screen-menu", "#FFF8F1", function () {
            if (ov !== null) {
                ov.remove();
            }
        });
    }
);

document.getElementById("btn-replay-prev").addEventListener(
    "click",
    function () {
        if (replayPlaying) {
            pauseReplay();
        } else {
            goToReplayStep(replayStep - 1, "backward");
        }
    }
);

document.getElementById("btn-replay-play-pause").addEventListener(
    "click",
    function () {
        if (replayPlaying) {
            pauseReplay();
        } else {
            playReplay();
        }
    }
);

document.getElementById("btn-replay-next").addEventListener(
    "click",
    function () {
        if (replayPlaying) {
            pauseReplay();
        }
        goToReplayStep(replayStep + 1, "forward");
    }
);

