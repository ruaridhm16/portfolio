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

function resizeCanvas() {
  dpr = window.devicePixelRatio || 1;
  displayWidth = Math.min(window.innerWidth * 0.9, 1000);
  displayHeight = 250;

  canvas.style.width = displayWidth + 'px';
  canvas.style.height = displayHeight + 'px';

  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;

  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset any transforms
  ctx.scale(dpr, dpr);
}

function drawBall() {
  ctx.clearRect(0, 0, displayWidth, displayHeight);

  ctx.beginPath();
  ctx.fillStyle = '#888'; // grey ball
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.closePath();
}

function updatePhysics() {
  if (!ball.dragging) {
    // Apply gravity to vertical velocity
    const gravity = 0.5; // Adjust for strength of gravity
    ball.vy += gravity;

    ball.x += ball.vx;
    ball.y += ball.vy;

    // Bounce off left and right walls (no gravity effect here)
    if (ball.x + ball.radius > displayWidth) {
      ball.x = displayWidth - ball.radius;
      ball.vx *= -1;
    } else if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.vx *= -1;
    }

    // Bounce off bottom with energy loss (simulate damping)
    const bounceEnergyLoss = 0.7; // 1 = perfect bounce, <1 loses energy

    if (ball.y + ball.radius > displayHeight) {
      ball.y = displayHeight - ball.radius;
      ball.vy *= -bounceEnergyLoss;

      // Optional small threshold to stop bouncing completely
      if (Math.abs(ball.vy) < 1) {
        ball.vy = 0;
      }
    }

    // Bounce off top (less likely but for completeness)
    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.vy *= -1;
    }

    // Apply horizontal damping/friction
    const friction = 0.98;
    ball.vx *= friction;

    // Stop very small velocities to avoid jitter
    if (Math.abs(ball.vx) < 0.05) ball.vx = 0;
    if (Math.abs(ball.vy) < 0.05) ball.vy = 0;
  }
}



function animate() {
  updatePhysics();
  drawBall();
  requestAnimationFrame(animate);
}

// Drag handlers
canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Check if mouse is inside the ball
  const dist = Math.hypot(mouseX - ball.x, mouseY - ball.y);
  if (dist <= ball.radius) {
    ball.dragging = true;
    ball.dragOffsetX = mouseX - ball.x;
    ball.dragOffsetY = mouseY - ball.y;
    // Stop velocity while dragging
    ball.vx = 0;
    ball.vy = 0;
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (!ball.dragging) return;

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Previous position for velocity calculation
  const prevX = ball.x;
  const prevY = ball.y;

  // Update ball position with offset
  ball.x = mouseX - ball.dragOffsetX;
  ball.y = mouseY - ball.dragOffsetY;

  // Clamp ball inside the container
  ball.x = Math.min(Math.max(ball.radius, ball.x), displayWidth - ball.radius);
  ball.y = Math.min(Math.max(ball.radius, ball.y), displayHeight - ball.radius);

  // Calculate velocity based on movement (momentum)
  ball.vx = ball.x - prevX;
  ball.vy = ball.y - prevY;
});

canvas.addEventListener('mouseup', () => {
  if (ball.dragging) {
    ball.dragging = false;
  }
});

canvas.addEventListener('mouseleave', () => {
  if (ball.dragging) {
    ball.dragging = false;
  }
});

// Initialize
resizeCanvas();
animate();

// Resize handler
window.addEventListener('resize', () => {
  resizeCanvas();
  // Optional: Clamp ball position after resize
  ball.x = Math.min(Math.max(ball.radius, ball.x), displayWidth - ball.radius);
  ball.y = Math.min(Math.max(ball.radius, ball.y), displayHeight - ball.radius);
});
