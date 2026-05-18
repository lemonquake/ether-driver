export function createCameraEffects() {
  return {
    trauma: 0,
    directionalBias: { x: 0, z: 0 },
    add(amount, direction = null) {
      this.trauma = Math.min(1.0, this.trauma + amount);
      if (direction) {
        this.directionalBias.x = direction.x * 0.6;
        this.directionalBias.z = direction.z * 0.6;
      }
    },
    update(dt) {
      this.trauma = Math.max(0, this.trauma - dt * 1.4);
      const shake = this.trauma * this.trauma;
      const biasFade = Math.min(1, dt * 3);
      this.directionalBias.x *= 1 - biasFade;
      this.directionalBias.z *= 1 - biasFade;
      return {
        x: (Math.random() - 0.5) * shake * 0.55 + this.directionalBias.x * shake,
        y: (Math.random() - 0.5) * shake * 0.3,
        z: (Math.random() - 0.5) * shake * 0.55 + this.directionalBias.z * shake,
      };
    },
  };
}
