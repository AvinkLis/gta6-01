// Canvas 2D renderer: city, cars, pedestrians, player, HUD (cash, wanted stars, health,
// mission + target arrow), minimap, and the title / pause / busted / wasted panels.
import { CAR_RADIUS, PLAYER_MAX_HP, WORLD_SIZE } from './config.js';
import { roadLines } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const FONT = '"Segoe UI", system-ui, sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function drawCar(car, cam) {
    const x = car.x - cam.x, y = car.y - cam.y;
    if (x < -60 || y < -60 || x > W + 60 || y > H + 60) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(car.angle);
    ctx.fillStyle = car.hp <= 0 ? '#333' : car.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-22, -11, 44, 22, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1b2631';
    ctx.beginPath(); ctx.roundRect(-6, -8, 15, 16, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(20, -8, 3, 5); ctx.fillRect(20, 3, 3, 5);
    if (car.kind === 'police') {
      ctx.fillStyle = '#212f3c'; ctx.fillRect(-14, -11, 20, 22);
      ctx.fillStyle = (Math.floor(performance.now() / 280) % 2 === 0) ? '#e74c3c' : '#3498db';
      ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `bold 8px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText('POLICE', -4, 3);
    }
    if (car.kind === 'target') {
      ctx.fillStyle = '#f9e79f'; ctx.font = `bold 9px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText('TARGET', 0, -18);
    }
    ctx.restore();
    if (car.hp < 55 && car.hp > 0) { // damage bar
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 20, y - 24, 40, 5);
      ctx.fillStyle = '#e74c3c'; ctx.fillRect(x - 20, y - 24, 40 * (car.hp / 100), 5);
    }
  }

  function draw(state, screen, best) {
    const p = state.player;
    const focus = p.inCar || p;
    const shakeX = state.shake ? (Math.sin(state.time * 71) * 6 * state.shake) : 0;
    const shakeY = state.shake ? (Math.cos(state.time * 83) * 6 * state.shake) : 0;
    const cam = {
      x: Math.max(0, Math.min(WORLD_SIZE - W, focus.x - W / 2 + shakeX)),
      y: Math.max(0, Math.min(WORLD_SIZE - H, focus.y - H / 2 + shakeY)),
    };
    if (WORLD_SIZE < W) cam.x = (WORLD_SIZE - W) / 2;
    if (WORLD_SIZE < H) cam.y = (WORLD_SIZE - H) / 2;

    // Ground: blocks (grass-ish), roads on top.
    ctx.fillStyle = '#3d5a3a'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8a8d90';
    for (const b of state.blocks) ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
    ctx.fillStyle = '#2e3138';
    const lines = roadLines();
    for (const l of lines) {
      ctx.fillRect(0, l - 52 - cam.y, W, 104);
      ctx.fillRect(l - 52 - cam.x, 0, 104, H);
    }
    ctx.strokeStyle = 'rgba(241,196,15,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([18, 16]);
    for (const l of lines) {
      ctx.beginPath(); ctx.moveTo(0, l - cam.y); ctx.lineTo(W, l - cam.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(l - cam.x, 0); ctx.lineTo(l - cam.x, H); ctx.stroke();
    }
    ctx.setLineDash([]);
    // Buildings
    for (const b of state.buildings) {
      const x = b.x - cam.x, y = b.y - cam.y;
      if (x + b.w < 0 || y + b.h < 0 || x > W || y > H) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(x + 5, y + 7, b.w, b.h);
      ctx.fillStyle = b.color; ctx.fillRect(x, y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      const iw = Math.max(14, b.w * b.roof * 0.55), ih = Math.max(14, b.h * b.roof * 0.55);
      ctx.fillRect(x + (b.w - iw) / 2, y + (b.h - ih) / 2, iw, ih);
    }
    // Mission marker
    const m = state.mission;
    if (m && m.target && screen !== SCREEN_TITLE) {
      const x = m.target.x - cam.x, y = m.target.y - cam.y;
      const pulse = 16 + Math.sin(state.time * 5) * 4;
      ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#f1c40f'; ctx.font = `bold 15px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText(m.phase === 'pickup' ? 'PACKAGE' : m.phase === 'drop' ? 'DROP-OFF' : '!', x, y - pulse - 8);
    }
    // Cars, peds, player
    for (const car of state.cars) if (car !== p.inCar) drawCar(car, cam);
    if (p.inCar) drawCar(p.inCar, cam);
    for (const ped of state.peds) {
      const x = ped.x - cam.x, y = ped.y - cam.y;
      if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      ctx.fillStyle = ped.down > 0 ? '#7f8c8d' : ped.color;
      ctx.beginPath(); ctx.arc(x, y, ped.down > 0 ? 10 : 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f5cba7'; ctx.beginPath(); ctx.arc(x, y - (ped.down > 0 ? 0 : 2), 3.4, 0, Math.PI * 2); ctx.fill();
    }
    if (!p.inCar) {
      const x = p.x - cam.x, y = p.y - cam.y;
      ctx.fillStyle = '#f39c12'; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7e5109'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#f5cba7'; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(p.angle) * 14, y + Math.sin(p.angle) * 14); ctx.stroke();
    }

    if (screen !== SCREEN_TITLE) drawHud(state, best, cam);
    if (screen === SCREEN_TITLE) panel(state, best, 'title');
    else if (screen === SCREEN_PAUSED) panel(state, best, 'paused');
    else if (screen === SCREEN_OVER) panel(state, best, 'over');
  }

  function drawHud(state, best, cam) {
    const p = state.player;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(10,12,16,0.62)';
    ctx.beginPath(); ctx.roundRect(14, 14, 316, 140, 10); ctx.fill();
    ctx.fillStyle = '#2ecc71'; ctx.font = `bold 24px ${FONT}`;
    ctx.fillText(`$${state.cash}`, 26, 44);
    ctx.fillStyle = '#f7dc6f'; ctx.font = `20px ${FONT}`;
    const stars = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    ctx.fillText(stars, 150, 44);
    // Health bars
    bar(26, 58, 180, 13, p.hp / PLAYER_MAX_HP, '#e74c3c', `HP ${Math.ceil(p.hp)}`);
    if (p.inCar) bar(26, 78, 180, 13, Math.max(0, p.inCar.hp) / 100, '#5dade2', `CAR ${Math.ceil(Math.max(0, p.inCar.hp))}`);
    ctx.fillStyle = '#ecf0f1'; ctx.font = `14px ${FONT}`;
    const m = state.mission;
    if (m) {
      ctx.fillText(m.title, 26, 116);
      ctx.fillStyle = '#f7dc6f';
      ctx.fillText(`Time ${Math.max(0, Math.ceil(m.timer))}s  •  Reward $${m.reward}`, 26, 138);
    } else ctx.fillText('Free roam — all jobs complete!', 26, 116);
    if (state.bustMeter > 0.12) {
      ctx.fillStyle = '#e74c3c'; ctx.font = `bold 18px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText('THE COPS ARE GRABBING YOU — MOVE!', W / 2, 54);
      bar(W / 2 - 110, 64, 220, 12, state.bustMeter / 1.6, '#e74c3c', '');
      ctx.textAlign = 'left';
    }
    if (state.messageTime > 0 && state.message) {
      ctx.fillStyle = 'rgba(10,12,16,0.66)'; ctx.beginPath(); ctx.roundRect(W / 2 - 280, H - 58, 560, 38, 9); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `16px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText(state.message, W / 2, H - 34); ctx.textAlign = 'left';
    }
    // Target arrow at screen edge / direction + distance
    if (m && m.target) {
      const focus = p.inCar || p;
      const dx = m.target.x - focus.x, dy = m.target.y - focus.y;
      const d = Math.hypot(dx, dy);
      const sx = m.target.x - cam.x, sy = m.target.y - cam.y;
      if (sx < 0 || sy < 0 || sx > W || sy > H) {
        const cx = W / 2, cy = H / 2, a = Math.atan2(dy, dx);
        const ex = cx + Math.cos(a) * Math.min(W, H) * 0.36, ey = cy + Math.sin(a) * Math.min(W, H) * 0.36;
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
        ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -9); ctx.lineTo(-10, 9); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#f7dc6f'; ctx.font = `bold 14px ${FONT}`; ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(d)}m`, ex, ey + 26); ctx.textAlign = 'left';
      }
    }
    drawMinimap(state);
  }

  function bar(x, y, w, h, frac, color, label) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
    ctx.fillStyle = '#fff'; ctx.font = `bold 10px ${FONT}`; ctx.fillText(label, x + 5, y + h - 3);
  }

  function drawMinimap(state) {
    const S = 148, x0 = W - S - 14, y0 = 14, k = S / WORLD_SIZE;
    ctx.fillStyle = 'rgba(10,12,16,0.72)'; ctx.beginPath(); ctx.roundRect(x0 - 4, y0 - 4, S + 8, S + 8, 8); ctx.fill();
    ctx.fillStyle = '#2e3138'; ctx.fillRect(x0, y0, S, S);
    ctx.fillStyle = '#596270';
    for (const b of state.buildings) ctx.fillRect(x0 + b.x * k, y0 + b.y * k, Math.max(1.5, b.w * k), Math.max(1.5, b.h * k));
    const dot = (e, color, r) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x0 + e.x * k, y0 + e.y * k, r, 0, Math.PI * 2); ctx.fill(); };
    for (const car of state.cars) if (car.kind === 'police') dot(car, '#5dade2', 2.4);
    if (state.mission && state.mission.target) dot(state.mission.target, '#f1c40f', 3.6);
    dot(state.player.inCar || state.player, '#ffffff', 3.4);
  }

  function panel(state, best, kind) {
    ctx.fillStyle = 'rgba(8,10,14,0.68)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    if (kind === 'title') {
      ctx.fillStyle = '#f39c12'; ctx.font = `bold 54px ${FONT}`;
      ctx.fillText('GRAND THEFT', W / 2, H / 2 - 120);
      ctx.fillStyle = '#ecf0f1'; ctx.font = `bold 64px ${FONT}`;
      ctx.fillText('BLOCK CITY', W / 2, H / 2 - 52);
      ctx.font = `19px ${FONT}`; ctx.fillStyle = '#d5dbdb';
      ctx.fillText('An open-world crime sandbox in one little city.', W / 2, H / 2 - 8);
      ctx.fillText('WASD / Arrows — walk & drive    Shift — run    E / F — enter / exit car', W / 2, H / 2 + 34);
      ctx.fillText('Space — brake    P / Esc — pause    R — restart', W / 2, H / 2 + 62);
      ctx.fillStyle = '#2ecc71'; ctx.font = `bold 21px ${FONT}`;
      ctx.fillText('Click or press Enter to start', W / 2, H / 2 + 112);
      if (best > 0) { ctx.fillStyle = '#f7dc6f'; ctx.font = `16px ${FONT}`; ctx.fillText(`Best cash: $${best}`, W / 2, H / 2 + 146); }
    } else if (kind === 'paused') {
      ctx.fillStyle = '#fff'; ctx.font = `bold 44px ${FONT}`; ctx.fillText('PAUSED', W / 2, H / 2 - 10);
      ctx.font = `18px ${FONT}`; ctx.fillText('Press P, Esc or Enter to keep playing', W / 2, H / 2 + 30);
    } else {
      const busted = state.over === 'BUSTED';
      ctx.fillStyle = busted ? '#5dade2' : '#e74c3c'; ctx.font = `bold 64px ${FONT}`;
      ctx.fillText(busted ? 'BUSTED' : 'WASTED', W / 2, H / 2 - 40);
      ctx.fillStyle = '#ecf0f1'; ctx.font = `20px ${FONT}`;
      ctx.fillText(busted ? 'The police held you down and cuffed you.' : 'You took too much damage.', W / 2, H / 2 + 4);
      ctx.fillText(`Cash earned: $${state.cash}   •   Jobs done: ${state.missionsDone}/3   •   Best: $${Math.max(best, state.cash)}`, W / 2, H / 2 + 40);
      ctx.fillStyle = '#2ecc71'; ctx.font = `bold 20px ${FONT}`;
      ctx.fillText('Press R or Enter to play again', W / 2, H / 2 + 84);
    }
    ctx.textAlign = 'left';
  }

  return { draw };
}
