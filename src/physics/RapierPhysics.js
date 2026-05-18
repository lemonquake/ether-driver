import RAPIER from '@dimforge/rapier3d-compat';

export async function createRapierPhysics() {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  return {
    RAPIER,
    world,
    createSensorSphere(radius, x, y, z) {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z));
      const collider = world.createCollider(RAPIER.ColliderDesc.ball(radius).setSensor(true), body);
      return { body, collider };
    },
    createProjectileBody(radius, x, y, z) {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z));
      const collider = world.createCollider(RAPIER.ColliderDesc.ball(radius), body);
      return { body, collider };
    },
    setTranslation(body, x, y, z) {
      body.setNextKinematicTranslation({ x, y, z });
    },
    remove(handle) {
      if (handle?.collider) world.removeCollider(handle.collider, true);
      if (handle?.body) world.removeRigidBody(handle.body);
    },
    step() {
      world.step();
    },
  };
}
