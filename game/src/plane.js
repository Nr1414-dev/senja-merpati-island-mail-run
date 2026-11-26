// SENJA MERPATI — the aircraft: low-poly planes built from primitives, so each
// one "looks built" (fuselage, wings, tail, spinning propeller, lit nav lights).
import * as THREE from 'three';

function buildPlaneMesh(spec) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: spec.color });
  const accentMat = new THREE.MeshLambertMaterial({ color: spec.accent });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x22262b });
  const glassMat = new THREE.MeshLambertMaterial({
    color: 0x1a2a3a, emissive: 0xffc46b, emissiveIntensity: 0.55,
  });

  // Fuselage: cylinder along Z (nose faces -Z), plus a nose cone.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.8, 6.4, 12), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.8, 12), accentMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -4.1;
  group.add(nose);
  // Cockpit canopy, glowing warm at dusk: the "instruments lit" cue.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), glassMat);
  canopy.scale.set(1, 0.75, 1.7);
  canopy.position.set(0, 0.85, -1.2);
  group.add(canopy);

  // Main wings: low wing with slight dihedral; tailplane + fin.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.28, 2.4), accentMat);
  wing.position.set(0, -0.15, -0.4);
  wing.rotation.z = 0.06;
  group.add(wing);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 2.4), bodyMat);
  wingTipL.position.set(-5.9, 0.2, -0.4);
  const wingTipR = wingTipL.clone();
  wingTipR.position.x = 5.9;
  group.add(wingTipL, wingTipR);
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.22, 1.5), accentMat);
  tailplane.position.set(0, 0.25, 3.1);
  group.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.1, 1.7), bodyMat);
  fin.position.set(0, 1.05, 3.2);
  group.add(fin);

  // Propeller: hub + two blades, spins around the nose axis.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), darkMat);
  prop.add(hub);
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x1c1f22 });
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.4, 0.12), bladeMat);
    blade.rotation.z = a;
    blade.position.y = 0;
    prop.add(blade);
  }
  prop.position.z = -5.05;
  group.add(prop);

  // Nav lights: red left, green right, white tail — emissive, lit at dusk.
  const navL = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff2a22 }),
  );
  navL.position.set(-5.9, -0.1, -0.4);
  const navR = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x2aff66 }),
  );
  navR.position.set(5.9, -0.1, -0.4);
  const navT = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  navT.position.set(0, 0.3, 3.9);
  group.add(navL, navR, navT);

  // Landing light: a small warm lamp under the nose.
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  lamp.position.set(0, -0.85, -3.4);
  group.add(lamp);

  // Amphibian floats.
  if (spec.floats) {
    for (const side of [-1, 1]) {
      const float = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 4.6, 8), accentMat);
      float.rotation.x = Math.PI / 2;
      float.position.set(side * 1.7, -1.25, -0.6);
      group.add(float);
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.16), darkMat);
      strut.position.set(side * 1.7, -0.6, -0.6);
      group.add(strut);
    }
  }

  // Scale the whole aircraft by type: bush is chunky, mail plane is sleek.
  const scale = spec.id === 'kilat' ? 0.92 : spec.id === 'albatros' ? 1.05 : 1.1;
  group.scale.setScalar(scale);
  return { group, prop };
}

export function createPlane(spec) {
  const { group, prop } = buildPlaneMesh(spec);
  return {
    group,
    spinProp(dt, speed) {
      prop.rotation.z += dt * (4 + speed * 1.4);
    },
  };
}
