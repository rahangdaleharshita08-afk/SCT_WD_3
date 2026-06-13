/* ==========================================================================
   NEON STRIKE - INTERACTIVE CONTROLLER & GAME LOGIC
   ========================================================================== */

// --- STATE VARIABLES ---
let gameMode = "pvc"; // "pvp" (Player vs Player) or "pvc" (Player vs Computer)
let difficulty = "medium"; // "easy", "medium", "hard"
let p1Name = "Player 1";
let p2Name = "HAL 9000";
let p1Color = "#00f3ff"; // Neon Cyan
let p2Color = "#ff007f"; // Neon Magenta
let currentPlayer = "X"; // "X" always goes first
let board = ["", "", "", "", "", "", "", "", ""];
let gameActive = false;
let soundEnabled = true;

// Scores
let scores = {
    p1: 0,
    p2: 0,
    ties: 0
};

// Web Audio API Context
let audioCtx = null;

// Confetti System Variables
let canvas = null;
let ctx = null;
let confettiParticles = [];
let confettiAnimationId = null;

// HTML Elements
const setupScreen = document.getElementById("setup-screen");
const gameScreen = document.getElementById("game-screen");
const boardElement = document.getElementById("game-board");
const cells = document.querySelectorAll(".cell");
const statusText = document.getElementById("status-text");

// Config inputs & buttons
const startBtn = document.getElementById("start-game-btn");
const resetBtn = document.getElementById("reset-btn");
const changeSettingsBtn = document.getElementById("change-settings-btn");
const soundToggle = document.getElementById("sound-toggle");
const soundOnIcon = document.getElementById("sound-on-icon");
const soundOffIcon = document.getElementById("sound-off-icon");

const modePvcBtn = document.getElementById("mode-pvc");
const modePvpBtn = document.getElementById("mode-pvp");
const aiDiffContainer = document.getElementById("ai-difficulty-container");
const diffBtns = document.querySelectorAll(".diff-btn");

const p1NameInput = document.getElementById("p1-name");
const p2NameInput = document.getElementById("p2-name");
const p2SetupTitle = document.getElementById("p2-setup-title");

// Scoreboard labels
const scoreP1Card = document.getElementById("score-p1");
const scoreP2Card = document.getElementById("score-p2");
const scoreP1Name = scoreP1Card.querySelector(".score-player-name");
const scoreP2Name = scoreP2Card.querySelector(".score-player-name");
const scoreP1Value = document.getElementById("score-p1-value");
const scoreP2Value = document.getElementById("score-p2-value");
const scoreTieValue = document.getElementById("score-tie-value");

// Winning Combinations
const WINNING_COMBOS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

// Computer Names by difficulty
const CPU_NAMES = {
    easy: "NOVICE-BOT",
    medium: "HAL 9000",
    hard: "GRANDMASTER-AI"
};

/* ==========================================================================
   INITIALIZATION & LISTENERS
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    loadSettings();
    initColorPickers();
    setupEventListeners();
    initConfettiCanvas();
});

// Load settings from localStorage if available
function loadSettings() {
    const savedP1Name = localStorage.getItem("ns_p1_name");
    const savedP2Name = localStorage.getItem("ns_p2_name");
    const savedP1Color = localStorage.getItem("ns_p1_color");
    const savedP2Color = localStorage.getItem("ns_p2_color");
    const savedSound = localStorage.getItem("ns_sound_enabled");
    
    if (savedP1Name) p1NameInput.value = savedP1Name;
    if (savedP2Name && gameMode === "pvp") p2NameInput.value = savedP2Name;
    
    if (savedP1Color) {
        p1Color = savedP1Color;
        document.querySelector("#p1-setup .avatar-glow").style.setProperty("--p-color", p1Color);
        updateActiveColorDot("#p1-setup", p1Color);
    }
    if (savedP2Color) {
        p2Color = savedP2Color;
        document.querySelector("#p2-setup .avatar-glow").style.setProperty("--p-color", p2Color);
        updateActiveColorDot("#p2-setup", p2Color);
    }
    
    if (savedSound !== null) {
        soundEnabled = savedSound === "true";
        updateSoundIcons();
    }
}

// Save names and colors to localStorage
function saveSettings() {
    localStorage.setItem("ns_p1_name", p1NameInput.value.trim());
    if (gameMode === "pvp") {
        localStorage.setItem("ns_p2_name", p2NameInput.value.trim());
    }
    localStorage.setItem("ns_p1_color", p1Color);
    localStorage.setItem("ns_p2_color", p2Color);
}

function updateActiveColorDot(containerId, color) {
    const dots = document.querySelectorAll(`${containerId} .color-dot`);
    dots.forEach(dot => {
        if (dot.dataset.color === color) {
            dot.classList.add("active");
        } else {
            dot.classList.remove("active");
        }
    });
}

// Set up event listeners for inputs, selectors, buttons, and board cells
function setupEventListeners() {
    // Mode Buttons
    modePvcBtn.addEventListener("click", () => setGameMode("pvc"));
    modePvpBtn.addEventListener("click", () => setGameMode("pvp"));
    
    // AI Difficulty Buttons
    diffBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            diffBtns.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            difficulty = e.target.dataset.diff;
            if (gameMode === "pvc") {
                p2NameInput.value = CPU_NAMES[difficulty];
            }
            playSynthSound("hover");
        });
    });
    
    // Sound Toggle
    soundToggle.addEventListener("click", () => {
        soundEnabled = !soundEnabled;
        localStorage.setItem("ns_sound_enabled", soundEnabled);
        updateSoundIcons();
        if (soundEnabled) {
            // Trigger quick sound test
            playSynthSound("hover");
        }
    });
    
    // Start / Restart Buttons
    startBtn.addEventListener("click", startMatch);
    resetBtn.addEventListener("click", () => resetBoard(true));
    changeSettingsBtn.addEventListener("click", exitToSetup);
    
    // Cell clicks & hovers
    cells.forEach(cell => {
        cell.addEventListener("click", handleCellClick);
        cell.addEventListener("mouseenter", handleCellMouseEnter);
        cell.addEventListener("mouseleave", handleCellMouseLeave);
    });
}

function updateSoundIcons() {
    if (soundEnabled) {
        soundOnIcon.classList.remove("hidden");
        soundOffIcon.classList.add("hidden");
    } else {
        soundOnIcon.classList.add("hidden");
        soundOffIcon.classList.remove("hidden");
    }
}

// Mode Selection
function setGameMode(mode) {
    gameMode = mode;
    playSynthSound("hover");
    
    if (mode === "pvc") {
        modePvcBtn.classList.add("active");
        modePvpBtn.classList.remove("active");
        aiDiffContainer.classList.remove("hidden");
        
        p2SetupTitle.textContent = "COMPUTER";
        p2NameInput.value = CPU_NAMES[difficulty];
        p2NameInput.disabled = true;
    } else {
        modePvcBtn.classList.remove("active");
        modePvpBtn.classList.add("active");
        aiDiffContainer.classList.add("hidden");
        
        p2SetupTitle.textContent = "PLAYER 2";
        const savedP2Name = localStorage.getItem("ns_p2_name");
        p2NameInput.value = savedP2Name ? savedP2Name : "Player 2";
        p2NameInput.disabled = false;
    }
}

// Color Picker setup
function initColorPickers() {
    const setups = ["p1-setup", "p2-setup"];
    setups.forEach(setupId => {
        const dots = document.querySelectorAll(`#${setupId} .color-dot`);
        dots.forEach(dot => {
            dot.addEventListener("click", (e) => {
                const selectedColor = e.target.dataset.color;
                
                // Remove active class from dots in this container
                dots.forEach(d => d.classList.remove("active"));
                e.target.classList.add("active");
                
                // Update avatar glow
                const avatar = document.querySelector(`#${setupId} .avatar-glow`);
                avatar.style.setProperty("--p-color", selectedColor);
                
                // Assign to global state
                if (setupId === "p1-setup") {
                    p1Color = selectedColor;
                } else {
                    p2Color = selectedColor;
                }
                
                playSynthSound("hover");
            });
        });
    });
}

/* ==========================================================================
   GAME MECHANICS
   ========================================================================== */

function startMatch() {
    // Collect Name Values
    p1Name = p1NameInput.value.trim() || "Player 1";
    if (gameMode === "pvp") {
        p2Name = p2NameInput.value.trim() || "Player 2";
    } else {
        p2Name = CPU_NAMES[difficulty];
    }
    
    saveSettings();
    playSynthSound("start");
    
    // Inject custom colors as global styles on the body for markup glows
    document.body.style.setProperty("--p1-color", p1Color);
    document.body.style.setProperty("--p2-color", p2Color);
    
    // Sync names and colors on Scoreboard
    scoreP1Name.textContent = p1Name;
    scoreP1Card.style.setProperty("--p-color", p1Color);
    
    scoreP2Name.textContent = p2Name;
    scoreP2Card.style.setProperty("--p-color", p2Color);
    
    // Load existing scores from session memory or default to 0
    scores.p1 = 0;
    scores.p2 = 0;
    scores.ties = 0;
    updateScoreboardDisplay();
    
    // Transition Screen
    setupScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    gameScreen.classList.add("fade-in");
    
    resetBoard(false);
}

function resetBoard(playSound = true) {
    board = ["", "", "", "", "", "", "", "", ""];
    currentPlayer = "X"; // P1 always goes first
    gameActive = true;
    
    // Reset Board visual styles
    boardElement.classList.remove("has-winner", "disabled");
    cells.forEach(cell => {
        cell.className = "cell";
        cell.textContent = "";
        cell.removeAttribute("style");
    });
    
    if (playSound) {
        playSynthSound("reset");
    }
    
    stopConfetti();
    updateGameStatus();
    updateScoreboardActiveGlow();
}

function updateGameStatus() {
    if (!gameActive) return;
    
    if (currentPlayer === "X") {
        statusText.textContent = `${p1Name.toUpperCase()}'S TURN`;
        statusText.style.color = p1Color;
        statusText.style.textShadow = `0 0 10px ${p1Color}`;
    } else {
        statusText.textContent = `${p2Name.toUpperCase()}'S TURN`;
        statusText.style.color = p2Color;
        statusText.style.textShadow = `0 0 10px ${p2Color}`;
    }
}

function updateScoreboardActiveGlow() {
    if (currentPlayer === "X" && gameActive) {
        scoreP1Card.classList.add("active-turn");
        scoreP2Card.classList.remove("active-turn");
    } else if (currentPlayer === "O" && gameActive) {
        scoreP1Card.classList.remove("active-turn");
        scoreP2Card.classList.add("active-turn");
    } else {
        scoreP1Card.classList.remove("active-turn");
        scoreP2Card.classList.remove("active-turn");
    }
}

function updateScoreboardDisplay() {
    scoreP1Value.textContent = scores.p1;
    scoreP2Value.textContent = scores.p2;
    scoreTieValue.textContent = scores.ties;
}

function exitToSetup() {
    playSynthSound("reset");
    stopConfetti();
    gameActive = false;
    
    gameScreen.classList.add("hidden");
    setupScreen.classList.remove("hidden");
    setupScreen.classList.add("fade-in");
}

/* ==========================================================================
   TURN & CLICK HANDLERS
   ========================================================================== */

function handleCellMouseEnter() {
    if (!gameActive || this.textContent !== "") return;
    
    // Render soft preview ghost of current marker
    if (currentPlayer === "X") {
        this.classList.add("preview-x");
    } else {
        this.classList.add("preview-o");
    }
}

function handleCellMouseLeave() {
    this.classList.remove("preview-x", "preview-o");
}

function handleCellClick() {
    const index = parseInt(this.dataset.index);
    
    // Ignore click if cell filled, game inactive, or computer's turn
    if (board[index] !== "" || !gameActive || (gameMode === "pvc" && currentPlayer === "O")) {
        return;
    }
    
    makeMove(index);
}

function makeMove(index) {
    board[index] = currentPlayer;
    
    // Render mark
    const cell = cells[index];
    cell.classList.remove("preview-x", "preview-o");
    
    if (currentPlayer === "X") {
        cell.classList.add("cell-x");
        cell.textContent = "X";
        playSynthSound("clickX");
    } else {
        cell.classList.add("cell-o");
        cell.textContent = "O";
        playSynthSound("clickO");
    }
    
    checkResult();
    
    if (gameActive) {
        // Switch players
        currentPlayer = currentPlayer === "X" ? "O" : "X";
        updateGameStatus();
        updateScoreboardActiveGlow();
        
        // PVC Mode check - trigger computer turn
        if (gameMode === "pvc" && currentPlayer === "O") {
            triggerComputerTurn();
        }
    }
}

/* ==========================================================================
   COMPUTER AI LOGIC
   ========================================================================== */

function triggerComputerTurn() {
    boardElement.classList.add("disabled");
    
    // Show AI thinking status
    statusText.textContent = `${p2Name.toUpperCase()} IS THINKING...`;
    statusText.style.color = p2Color;
    statusText.style.textShadow = `0 0 10px ${p2Color}`;
    
    // Artificial latency (500ms - 850ms) to make it feel responsive but natural
    const delay = 500 + Math.random() * 350;
    
    setTimeout(() => {
        if (!gameActive) return; // Prevent moves if game was reset during timeout
        
        const computerMoveIndex = getComputerMove();
        boardElement.classList.remove("disabled");
        makeMove(computerMoveIndex);
    }, delay);
}

function getComputerMove() {
    if (difficulty === "easy") {
        return getEasyMove();
    } else if (difficulty === "medium") {
        return getMediumMove();
    } else {
        return getHardMove();
    }
}

// 1. Easy Mode: Complete Randomness
function getEasyMove() {
    const emptyCells = getEmptyCellIndices();
    const randomIndex = Math.floor(Math.random() * emptyCells.length);
    return emptyCells[randomIndex];
}

// 2. Medium Mode: Tactician (Smart blocks/wins + random mix)
function getMediumMove() {
    // Check if AI can win immediately in this turn
    const winningMove = findWinningOrBlockingMove("O");
    if (winningMove !== null) return winningMove;
    
    // Check if player is about to win and block them
    const blockingMove = findWinningOrBlockingMove("X");
    if (blockingMove !== null) return blockingMove;
    
    // Try to grab center cell (index 4) with 45% probability
    if (board[4] === "" && Math.random() < 0.45) {
        return 4;
    }
    
    // Fall back to random move
    return getEasyMove();
}

// Helper to look for an immediate winning or blocking slot
function findWinningOrBlockingMove(playerMarker) {
    for (let combo of WINNING_COMBOS) {
        const [a, b, c] = combo;
        const vals = [board[a], board[b], board[c]];
        
        // If 2 cells match the target and the 3rd is empty
        const markerCount = vals.filter(v => v === playerMarker).length;
        const emptyCount = vals.filter(v => v === "").length;
        
        if (markerCount === 2 && emptyCount === 1) {
            if (board[a] === "") return a;
            if (board[b] === "") return b;
            if (board[c] === "") return c;
        }
    }
    return null;
}

// 3. Hard Mode: Unbeatable Minimax
function getHardMove() {
    let bestScore = -Infinity;
    let bestMove = null;
    
    // Compute scores for all empty cells
    for (let i = 0; i < 9; i++) {
        if (board[i] === "") {
            board[i] = "O"; // Simulate CPU move
            let score = minimax(board, 0, false);
            board[i] = ""; // Undo simulate
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = i;
            }
        }
    }
    return bestMove;
}

// Minimax algorithm core
function minimax(tempBoard, depth, isMaximizing) {
    const winnerMarker = checkBoardWinner(tempBoard);
    if (winnerMarker === "O") return 10 - depth; // CPU wins
    if (winnerMarker === "X") return depth - 10; // Player wins
    if (isBoardFull(tempBoard)) return 0;       // Draw
    
    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (tempBoard[i] === "") {
                tempBoard[i] = "O";
                let score = minimax(tempBoard, depth + 1, false);
                tempBoard[i] = "";
                bestScore = Math.max(score, bestScore);
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < 9; i++) {
            if (tempBoard[i] === "") {
                tempBoard[i] = "X";
                let score = minimax(tempBoard, depth + 1, true);
                tempBoard[i] = "";
                bestScore = Math.min(score, bestScore);
            }
        }
        return bestScore;
    }
}

// Quick check methods for minimax simulations
function checkBoardWinner(b) {
    for (let combo of WINNING_COMBOS) {
        const [x, y, z] = combo;
        if (b[x] !== "" && b[x] === b[y] && b[y] === b[z]) {
            return b[x];
        }
    }
    return null;
}

function isBoardFull(b) {
    return !b.includes("");
}

function getEmptyCellIndices() {
    const indices = [];
    for (let i = 0; i < 9; i++) {
        if (board[i] === "") indices.push(i);
    }
    return indices;
}

/* ==========================================================================
   WIN / DRAW JUDGEMENT
   ========================================================================== */

function checkResult() {
    let roundWon = false;
    let winningCombo = null;
    
    for (let i = 0; i < WINNING_COMBOS.length; i++) {
        const combo = WINNING_COMBOS[i];
        const a = board[combo[0]];
        const b = board[combo[1]];
        const c = board[combo[2]];
        
        if (a === "" || b === "" || c === "") {
            continue;
        }
        
        if (a === b && b === c) {
            roundWon = true;
            winningCombo = combo;
            break;
        }
    }
    
    if (roundWon) {
        gameActive = false;
        boardElement.classList.add("has-winner", "disabled");
        
        const winnerColor = currentPlayer === "X" ? p1Color : p2Color;
        const winnerName = currentPlayer === "X" ? p1Name : p2Name;
        
        // Highlight winning cells
        winningCombo.forEach(idx => {
            const cell = cells[idx];
            cell.classList.add("winner");
            cell.style.setProperty("--winner-color", winnerColor);
        });
        
        // Increment Scoreboard
        if (currentPlayer === "X") {
            scores.p1++;
        } else {
            scores.p2++;
        }
        updateScoreboardDisplay();
        updateScoreboardActiveGlow();
        
        // Update status UI
        statusText.textContent = `${winnerName.toUpperCase()} WINS!`;
        statusText.style.color = winnerColor;
        statusText.style.textShadow = `0 0 15px ${winnerColor}, 0 0 5px #fff`;
        
        // FX
        playSynthSound("win");
        triggerConfetti(winnerColor);
        return;
    }
    
    // Check for Tie
    if (!board.includes("")) {
        gameActive = false;
        boardElement.classList.add("disabled");
        scores.ties++;
        updateScoreboardDisplay();
        updateScoreboardActiveGlow();
        
        statusText.textContent = "IT'S A DRAW!";
        statusText.style.color = "var(--text-secondary)";
        statusText.style.textShadow = "0 0 10px rgba(142, 149, 179, 0.4)";
        
        playSynthSound("draw");
        return;
    }
}

/* ==========================================================================
   WEB AUDIO API SOUND GENERATOR
   ========================================================================== */

function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
}

function playSynthSound(type) {
    if (!soundEnabled) return;
    
    try {
        initAudioContext();
        const now = audioCtx.currentTime;
        
        // Master Gain node
        const masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(0.12, now); // Prevent overly loud beeps
        masterGain.connect(audioCtx.destination);
        
        if (type === "hover") {
            // Short subtle blip
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = "sine";
            osc.frequency.setValueAtTime(160, now);
            osc.frequency.exponentialRampToValueAtTime(110, now + 0.04);
            
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
            
            osc.connect(gain);
            gain.connect(masterGain);
            
            osc.start(now);
            osc.stop(now + 0.05);
        }
        else if (type === "clickX") {
            // Bright upward cyber chirp
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = "triangle";
            osc.frequency.setValueAtTime(450, now);
            osc.frequency.exponentialRampToValueAtTime(750, now + 0.07);
            
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
            
            osc.connect(gain);
            gain.connect(masterGain);
            
            osc.start(now);
            osc.stop(now + 0.08);
        }
        else if (type === "clickO") {
            // Slower, hollow pitch-dropping tone
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = "sine";
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(240, now + 0.07);
            
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
            
            osc.connect(gain);
            gain.connect(masterGain);
            
            osc.start(now);
            osc.stop(now + 0.08);
        }
        else if (type === "start") {
            // Retro gaming power-up chime
            const playNote = (freq, time, len) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, time);
                
                gain.gain.setValueAtTime(0.1, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + len);
                
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(time);
                osc.stop(time + len + 0.01);
            };
            
            playNote(261.63, now, 0.08);       // C4
            playNote(329.63, now + 0.07, 0.08); // E4
            playNote(392.00, now + 0.14, 0.08); // G4
            playNote(523.25, now + 0.21, 0.18); // C5
        }
        else if (type === "reset") {
            // Sweeping sci-fi sound
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = "sine";
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(1000, now + 0.14);
            
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
            
            osc.connect(gain);
            gain.connect(masterGain);
            
            osc.start(now);
            osc.stop(now + 0.15);
        }
        else if (type === "draw") {
            // Low buzz
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(110, now);
            osc.frequency.linearRampToValueAtTime(75, now + 0.35);
            
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.35);
            
            // Add a lowpass filter to make it warmer/cyberpunk
            const filter = audioCtx.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.setValueAtTime(300, now);
            
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(masterGain);
            
            osc.start(now);
            osc.stop(now + 0.4);
        }
        else if (type === "win") {
            // High energy retro melody
            const playNote = (freq, time, len, wave = "sine") => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = wave;
                osc.frequency.setValueAtTime(freq, time);
                
                gain.gain.setValueAtTime(0.08, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + len);
                
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(time);
                osc.stop(time + len + 0.01);
            };
            
            playNote(523.25, now, 0.12, "triangle");       // C5
            playNote(659.25, now + 0.1, 0.12, "triangle");  // E5
            playNote(783.99, now + 0.2, 0.12, "triangle");  // G5
            playNote(1046.50, now + 0.3, 0.3, "sine");      // C6
            playNote(1318.51, now + 0.45, 0.4, "sine");     // E6
        }
    } catch (e) {
        console.error("Synthesizer audio failed to generate", e);
    }
}

/* ==========================================================================
   CANVAS PARTICLE SYSTEM (CONFETTI EXPLOSION)
   ========================================================================== */

function initConfettiCanvas() {
    canvas = document.getElementById("confetti-canvas");
    ctx = canvas.getContext("2d");
    
    resizeConfettiCanvas();
    window.addEventListener("resize", resizeConfettiCanvas);
}

function resizeConfettiCanvas() {
    if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 8 + 4;
        this.color = color;
        
        // Spawn angle pointing up and slightly inwards
        const angle = x < window.innerWidth / 2 
            ? (Math.random() * -65 - 15) * Math.PI / 180  // shoot right and up (-15deg to -80deg)
            : (Math.random() * -65 - 100) * Math.PI / 180; // shoot left and up (-100deg to -165deg)
            
        this.speed = Math.random() * 15 + 10;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
        this.gravity = 0.38;
        this.opacity = 1.0;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 6 - 3;
        this.shape = Math.random() < 0.4 ? "circle" : "square";
    }
    
    update() {
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;
        this.opacity -= 0.008; // slow fade out
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.globalAlpha = Math.max(0, this.opacity);
        ctx.fillStyle = this.color;
        
        // Subtle glow filter
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        
        ctx.beginPath();
        if (this.shape === "circle") {
            ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        }
        
        ctx.restore();
    }
}

function triggerConfetti(primaryColor) {
    stopConfetti();
    
    // Dual fountain from corners
    const leftCornerX = 0;
    const rightCornerX = window.innerWidth;
    const spawnY = window.innerHeight;
    
    const colors = [
        primaryColor, 
        "#ffffff", 
        primaryColor === p1Color ? p2Color : p1Color, // Secondary glow color
        "#ffff00" // Sparks
    ];
    
    // Generate particles in bursts
    const numParticles = 120;
    for (let i = 0; i < numParticles; i++) {
        const c = colors[Math.floor(Math.random() * colors.length)];
        
        if (i < numParticles / 2) {
            confettiParticles.push(new Particle(leftCornerX + 10, spawnY - 10, c));
        } else {
            confettiParticles.push(new Particle(rightCornerX - 10, spawnY - 10, c));
        }
    }
    
    animateConfetti();
}

function animateConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Filter out invisible particles
    confettiParticles = confettiParticles.filter(p => p.opacity > 0 && p.y < canvas.height + 20);
    
    confettiParticles.forEach(p => {
        p.update();
        p.draw();
    });
    
    if (confettiParticles.length > 0) {
        confettiAnimationId = requestAnimationFrame(animateConfetti);
    }
}

function stopConfetti() {
    if (confettiAnimationId) {
        cancelAnimationFrame(confettiAnimationId);
        confettiAnimationId = null;
    }
    if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    confettiParticles = [];
}