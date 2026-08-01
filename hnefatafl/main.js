
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

const appendToBlock = function (block, text) {
    const log = document.getElementById("info-board");
    const entry = document.createElement("div");
    entry.classList.add("log-turn-entry");
    entry.textContent = text;
    block.appendChild(entry);
    log.scrollTop = log.scrollHeight;
};

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

const animateCapturedPieces = function () {
    const boardElement = document.getElementById("board");
    animateCaptureImages(boardElement, pendingCaptures);
    pendingCaptures = [];
};

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

const showTurnIndicator = function (side) {
    const log = document.getElementById("info-board");
    const indicator = document.createElement("div");
    indicator.textContent = MESSAGES.turnIndicator(side);
    indicator.classList.add("log-turn-indicator");
    log.appendChild(indicator);
    log.scrollTop = log.scrollHeight;
    turnIndicator = indicator;
};

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

const isLegalMoveTarget = function (rowIndex, colIndex) {
    return legalMoves.some(function (move) {
        return move[0] === rowIndex && move[1] === colIndex;
    });
};

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

const renderBoard = function (board) {
    const boardElement = document.getElementById("board");
    board.forEach(function (row, rowIndex) {
        row.forEach(function (cell, colIndex) {

            const cellElement = createCellElement(cell, rowIndex, colIndex);

            cellElement.setAttribute("tabindex", (
                (rowIndex === 0 && colIndex === 0)
                ? "0"
                : "-1"
            ));
            cellElement.setAttribute("role", "button");

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

const renderLabels = function () {
    renderLabelSet("row-labels", "col-labels");
};

const render = function () {
    const boardElement = document.getElementById("board");
    boardElement.innerHTML = "";
    renderBoard(game.board);
    updatePageStyle();
};

onCellClick = function () {
    render();
    animateCapturedPieces();
};

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

const renderReplayLabels = function () {
    renderLabelSet("replay-row-labels", "replay-col-labels");
};

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

const pauseReplay = function () {
    if (replayInterval !== null) {
        window.clearInterval(replayInterval);
        replayInterval = null;
    }
    replayPlaying = false;
    const btn = document.getElementById("btn-replay-play-pause");
    btn.style.backgroundImage = "url('assets/button-icon-play.svg')";
};

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

const isMobileViewport = function () {
    return window.matchMedia("(max-width: 700px)").matches;
};

const showDesktopDisclaimer = function (onDismiss) {
    const overlay = document.createElement("div");
    overlay.id = "confirm-modal";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Desktop notice");

    const card = document.createElement("div");
    card.classList.add("confirm-card");

    const msgLine1 = document.createElement("p");
    msgLine1.classList.add("confirm-message");
    msgLine1.textContent = "This was designed for desktop, not mobile.";

    const msgLine2 = document.createElement("p");
    msgLine2.classList.add("confirm-message");
    msgLine2.textContent = "A mobile-friendly version is planned.";

    const btnOk = document.createElement("button");
    btnOk.id = "btn-disclaimer-ok";
    btnOk.classList.add("text-btn");
    btnOk.textContent = "Got it";

    const removeModal = function () {
        overlay.remove();
    };

    btnOk.addEventListener("click", function () {
        removeModal();
        onDismiss();
    });

    overlay.addEventListener("keydown", function (evt) {
        if (evt.key === "Escape" || evt.key === "Enter") {
            btnOk.click();
        }
    });

    card.appendChild(msgLine1);
    card.appendChild(msgLine2);
    card.appendChild(btnOk);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    btnOk.focus();
};

document.getElementById("btn-play").addEventListener(
    "click",
    function () {
        const enterGame = function () {
            startGame();
            transitionTo("screen-game", "#2C2C2C");
        };
        if (isMobileViewport()) {
            showDesktopDisclaimer(enterGame);
        } else {
            enterGame();
        }
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

document.getElementById("btn-back-portfolio").addEventListener(
    "click",
    function (event) {
        const cameFromSameSite = (
            document.referrer
            && document.referrer.indexOf(window.location.host) !== -1
        );
        if (cameFromSameSite && window.history.length > 1) {
            event.preventDefault();
            window.history.back();
        }
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
