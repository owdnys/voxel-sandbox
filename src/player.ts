import { PerspectiveCamera, Vector3 } from 'three';
import { Block, SOLID, WORLD_HEIGHT, WORLD_RADIUS, CHUNK_SIZE } from './blocks';
import { Vec3, World } from './world';

export interface Hit { block: Vec3; normal: Vec3; type: Block }
export function trace(world: World, origin: Vector3, direction: Vector3, reach = 6): Hit | null {
  const x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const cell: Vec3 = [x, y, z];
  const step: Vec3 = [Math.sign(direction.x), Math.sign(direction.y), Math.sign(direction.z)];
  const delta: Vec3 = [Math.abs(1 / direction.x), Math.abs(1 / direction.y), Math.abs(1 / direction.z)];
  const side: Vec3 = [
    step[0] === 0 ? Infinity : (step[0] > 0 ? x + 1 - origin.x : origin.x - x) * delta[0],
    step[1] === 0 ? Infinity : (step[1] > 0 ? y + 1 - origin.y : origin.y - y) * delta[1],
    step[2] === 0 ? Infinity : (step[2] > 0 ? z + 1 - origin.z : origin.z - z) * delta[2],
  ];
  let distance = 0;
  while (distance <= reach) {
    const type = world.get(...cell);
    if (type !== Block.Air && type !== Block.Water) return { block: [...cell], normal: [0, 0, 0], type };
    const axis = side[0] < side[1] ? (side[0] < side[2] ? 0 : 2) : (side[1] < side[2] ? 1 : 2);
    distance = side[axis];
    cell[axis] += step[axis];
    side[axis] += delta[axis];
    if (distance > reach) break;
    const found = world.get(...cell);
    if (found !== Block.Air && found !== Block.Water) {
      const normal: Vec3 = [0, 0, 0];
      normal[axis] = -step[axis];
      return { block: [...cell], normal, type: found };
    }
  }
  return null;
}

const RADIUS = .28;
const EYE_HEIGHT = 1.62;
const BODY_HEIGHT = 1.8;
const EPS = .0001;

export class Player {
  readonly position = new Vector3();
  readonly keys = new Set<string>();
  readonly camera: PerspectiveCamera;
  readonly direction = new Vector3();
  yaw = -.7;
  pitch = -.2;
  velocityY = 0;
  grounded = false;
  mobileX = 0;
  mobileY = 0;
  jumpHeld = false;
  sensitivity = .0022;
  constructor(readonly world: World, position: Vec3) {
    this.position.set(...position);
    this.camera = new PerspectiveCamera(76, innerWidth / innerHeight, .04, 150);
    this.camera.rotation.order = 'YXZ';
    this.syncCamera();
  }
  syncCamera() {
    this.camera.position.copy(this.position);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.camera.getWorldDirection(this.direction);
  }
  look(dx: number, dy: number, scale = 1) {
    this.yaw -= dx * this.sensitivity * scale;
    this.pitch = Math.max(-Math.PI * .49, Math.min(Math.PI * .49, this.pitch - dy * this.sensitivity * scale));
    this.syncCamera();
  }
  private occupiedAt(px: number, eyeY: number, pz: number) {
    const minX = Math.floor(px - RADIUS + EPS), maxX = Math.floor(px + RADIUS - EPS);
    const minY = Math.floor(eyeY - EYE_HEIGHT + EPS), maxY = Math.floor(eyeY - EYE_HEIGHT + BODY_HEIGHT - EPS);
    const minZ = Math.floor(pz - RADIUS + EPS), maxZ = Math.floor(pz + RADIUS - EPS);
    for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
      if (SOLID(this.world.get(x, y, z))) return true;
    }
    return false;
  }
  overlaps(block: Vec3) {
    return block[0] < this.position.x + RADIUS && block[0] + 1 > this.position.x - RADIUS &&
      block[1] < this.position.y - EYE_HEIGHT + BODY_HEIGHT && block[1] + 1 > this.position.y - EYE_HEIGHT &&
      block[2] < this.position.z + RADIUS && block[2] + 1 > this.position.z - RADIUS;
  }
  private moveAxis(axis: 'x' | 'y' | 'z', amount: number): boolean {
    if (!amount) return false;
    const steps = Math.ceil(Math.abs(amount) / .08);
    const step = amount / steps;
    for (let i = 0; i < steps; i++) {
      const next = this.position[axis] + step;
      if (axis !== 'y' && Math.abs(next) > WORLD_RADIUS * CHUNK_SIZE - RADIUS - .01) return true;
      if (axis === 'y' && (next < EYE_HEIGHT + 1 || next > WORLD_HEIGHT + EYE_HEIGHT + 3)) return true;
      const x = axis === 'x' ? next : this.position.x;
      const y = axis === 'y' ? next : this.position.y;
      const z = axis === 'z' ? next : this.position.z;
      if (this.occupiedAt(x, y, z)) return true;
      this.position[axis] = next;
    }
    return false;
  }
  update(dt: number) {
    const forward = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS')) - this.mobileY;
    const strafe = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')) + this.mobileX;
    const length = Math.max(1, Math.hypot(forward, strafe));
    const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 7.5 : 4.7;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    this.moveAxis('x', (-sin * forward + cos * strafe) / length * speed * dt);
    this.moveAxis('z', (-cos * forward - sin * strafe) / length * speed * dt);
    if ((this.keys.has('Space') || this.jumpHeld) && this.grounded) { this.velocityY = 8.1; this.grounded = false; }
    this.velocityY = Math.max(-30, this.velocityY - 22 * dt);
    const blocked = this.moveAxis('y', this.velocityY * dt);
    if (blocked) { this.grounded = this.velocityY <= 0; this.velocityY = 0; }
    else this.grounded = false;
    this.syncCamera();
  }
  clearInput() { this.keys.clear(); this.mobileX = 0; this.mobileY = 0; this.jumpHeld = false; }
}
