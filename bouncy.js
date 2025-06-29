const canvas = document.getElementById('ballCanvas');
const ctx = canvas.getContext('2d');

let displayWidth, displayHeight;
let dpr = window.devicePixelRatio || 1;

const ball = {
  radius: 20,
  x: 50,
  y: 50,
  vx: 3,
  vy: 3,
  dragging: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
};

// Get pointer position relative to canvas, for mouse or touch
function getEventPos(evt) {
  const rect = canvas.getBoundingClientRect();

  let clientX, clientY;
  if (evt.touches && evt.touches.length > 0) {
    clientX = evt.touches[0].clientX;
    clientY = evt.touches[0].clientY;
  } else {
    clientX = evt.clientX;
    clientY = evt.clientY;
  }

  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

function resizeCanvas() {
  dpr = window.devicePixelRatio || 1;
  displayWidth = Math.min(window.innerWidth * 0.9, 1000);
  displayHeight = 250;

  canvas.style.width = displayWidth + 'px';
  canvas.style.height = displayHeight + 'px';

  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;

  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transforms
  ctx.scale(dpr, dpr);

  // Keep ball within new boundaries
  ball.x = Math.min(Math.max(ball.radius, ball.x), displayWidth - ball.radius);
  ball.y = Math.min(Math.max(ball.radius, ball.y), displayHeight - ball.radius);
}

function drawBall() {
  ctx.clearRect(0, 0, displayWidth, displayHeight);

  ctx.beginPath();
  ctx.fillStyle = '#888';
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.closePath();
}

function updatePhysics() {
  if (!ball.dragging) {
    const gravity = 0.5;
    const bounceEnergyLoss = 0.7;
    const friction = 0.98;

    // Apply gravity
    ball.vy += gravity;

    ball.x += ball.vx;
    ball.y += ball.vy;

    // Bounce horizontal walls
    if (ball.x + ball.radius > displayWidth) {
      ball.x = displayWidth - ball.radius;
      ball.vx *= -1;
    } else if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.vx *= -1;
    }

    // Bounce bottom wall
    if (ball.y + ball.radius > displayHeight) {
      ball.y = displayHeight - ball.radius;
      ball.vy *= -bounceEnergyLoss;
      if (Math.abs(ball.vy) < 1) ball.vy = 0;
    }

    // Bounce top wall
    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.vy *= -1;
    }

    // Apply friction
    ball.vx *= friction;

    // Stop tiny movements
    if (Math.abs(ball.vx) < 0.05) ball.vx = 0;
    if (Math.abs(ball.vy) < 0.05) ball.vy = 0;
  }
}

function animate() {
  updatePhysics();
  drawBall();
  requestAnimationFrame(animate);
}

function startDrag(evt) {
  evt.preventDefault();
  const pos = getEventPos(evt);
  const dist = Math.hypot(pos.x - ball.x, pos.y - ball.y);
  if (dist <= ball.radius) {
    ball.dragging = true;
    ball.dragOffsetX = pos.x - ball.x;
    ball.dragOffsetY = pos.y - ball.y;
    ball.vx = 0;
    ball.vy = 0;
  }
}

function dragMove(evt) {
  if (!ball.dragging) return;
  evt.preventDefault();

  const pos = getEventPos(evt);
  const prevX = ball.x;
  const prevY = ball.y;

  ball.x = pos.x - ball.dragOffsetX;
  ball.y = pos.y - ball.dragOffsetY;

  // Keep inside boundaries
  ball.x = Math.min(Math.max(ball.radius, ball.x), displayWidth - ball.radius);
  ball.y = Math.min(Math.max(ball.radius, ball.y), displayHeight - ball.radius);

  // Calculate velocity based on drag movement
  ball.vx = ball.x - prevX;
  ball.vy = ball.y - prevY;
}

function endDrag(evt) {
  if (ball.dragging) {
    ball.dragging = false;
  }
}

// Attach event listeners with proper options
canvas.addEventListener('mousedown', startDrag);
canvas.addEventListener('mousemove', dragMove);
canvas.addEventListener('mouseup', endDrag);
canvas.addEventListener('mouseleave', endDrag);

canvas.addEventListener('touchstart', startDrag, { passive: false });
canvas.addEventListener('touchmove', dragMove, { passive: false });
canvas.addEventListener('touchend', endDrag);
canvas.addEventListener('touchcancel', endDrag);

window.addEventListener('resize', resizeCanvas);

// Initialize
resizeCanvas();
animate();
