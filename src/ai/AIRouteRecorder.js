import { findNearestWaypoint, addLearnedRoutes } from './NavigationSystem.js';

const storageKey = 'etherDriver.aiRoutes.v1';
const maxSessions = 24;
const maxPointsPerSession = 180;

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

export function loadSavedRouteSessions() {
  const sessions = safeParse(localStorage.getItem(storageKey) || '[]');
  return Array.isArray(sessions) ? sessions : [];
}

function saveRouteSessions(sessions) {
  localStorage.setItem(storageKey, JSON.stringify(sessions.slice(-maxSessions)));
}

export function createRouteRecorder(ctx, button) {
  const recorder = {
    recording: false,
    elapsed: 0,
    current: null,
    sessions: loadSavedRouteSessions(),
    toggle() {
      if (this.recording) this.stop();
      else this.start();
    },
    start() {
      this.recording = true;
      this.elapsed = 0;
      this.current = {
        id: `route-${Date.now().toString(36)}`,
        mapId: 'street-circuit',
        createdAt: Date.now(),
        points: [],
      };
      updateButton(this, button);
    },
    stop() {
      this.recording = false;
      if (this.current?.points?.length >= 2) {
        this.sessions.push(this.current);
        this.sessions = this.sessions.slice(-maxSessions);
        saveRouteSessions(this.sessions);
        addLearnedRoutes(ctx.navigation, this.sessions);
        flashSaved(this, button);
      } else {
        updateButton(this, button);
      }
      this.current = null;
    },
    update(dt) {
      if (!this.recording || !ctx.player || ctx.player.health.dead) return;
      this.elapsed += dt;
      if (this.elapsed < 1) return;
      this.elapsed = 0;
      const nearest = findNearestWaypoint(ctx.navigation, ctx.player.transform);
      this.current.points.push({
        x: Number(ctx.player.transform.x.toFixed(2)),
        z: Number(ctx.player.transform.z.toFixed(2)),
        yaw: Number(ctx.player.transform.yaw.toFixed(3)),
        speed: Number(ctx.player.velocity.speed.toFixed(2)),
        aimX: Number(ctx.input.aimPoint.x.toFixed(2)),
        aimZ: Number(ctx.input.aimPoint.z.toFixed(2)),
        waypointId: nearest?.id ?? null,
        t: Date.now(),
      });
      this.current.points = this.current.points.slice(-maxPointsPerSession);
      updateButton(this, button);
    },
  };
  addLearnedRoutes(ctx.navigation, recorder.sessions);
  button?.addEventListener('click', () => recorder.toggle());
  updateButton(recorder, button);
  return recorder;
}

function updateButton(recorder, button) {
  if (!button) return;
  button.classList.toggle('recording', recorder.recording);
  const count = recorder.current?.points?.length || recorder.sessions.reduce((sum, session) => sum + session.points.length, 0);
  button.textContent = recorder.recording ? `RECORDING ${count}` : 'RECORD';
  button.title = `${recorder.sessions.length} saved AI route sessions`;
}

function flashSaved(recorder, button) {
  if (!button) return;
  button.classList.remove('recording');
  button.classList.add('saved');
  button.textContent = 'SAVED';
  setTimeout(() => {
    button.classList.remove('saved');
    updateButton(recorder, button);
  }, 900);
}
