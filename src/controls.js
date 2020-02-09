import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.112.1/build/three.module.js';
import {PointerLockControls} from 'https://cdn.jsdelivr.net/npm/three@0.112.1/examples/jsm/controls/PointerLockControls.js';


export const controls = (function() {
  return {
    // FPSControls was adapted heavily from a threejs example. Movement control
    // and collision detection was completely rewritten, but credit to original
    // class for the setup code.
    FPSControls: class {
      constructor(params) {
        this._cells = params.cells;
        this._Init(params);
      }

      _Init(params) {
        this._radius = 2;
        this._enabled = false;
        this._move = {
          forward: false,
          backward: false,
          left: false,
          right: false,
        };
        this._standing = true;
        this._velocity = new THREE.Vector3(0, 0, 0);
        this._decceleration = new THREE.Vector3(-10, -9.8, -10);
        this._acceleration = new THREE.Vector3(30, 7, 80);

        this._SetupPointerLock();

        this._controls = new PointerLockControls(
            params.camera, document.body);
        this._controls.getObject().position.set(38, 50, 354);
        params.scene.add(this._controls.getObject());

        document.addEventListener('keydown', (e) => this._onKeyDown(e), false);
        document.addEventListener('keyup', (e) => this._onKeyUp(e), false);
      }

      _onKeyDown(event) {
        switch (event.keyCode) {
          case 38: // up
          case 87: // w
            this._move.forward = true;
            break;
          case 37: // left
          case 65: // a
            this._move.left = true; break;
          case 40: // down
          case 83: // s
            this._move.backward = true;
            break;
          case 39: // right
          case 68: // d
            this._move.right = true;
            break;
          case 32: // space
            if (this._standing) this._velocity.y += this._acceleration.y;
            this._standing = false;
            break;
        }
      }

      _onKeyUp(event) {
        switch(event.keyCode) {
          case 38: // up
          case 87: // w
            this._move.forward = false;
            break;
          case 37: // left
          case 65: // a
            this._move.left = false;
            break;
          case 40: // down
          case 83: // s
            this._move.backward = false;
            break;
          case 39: // right
          case 68: // d
            this._move.right = false;
            break;
          case 33: // PG_UP
            this._cells.ChangeActiveTool(1);
            break;
          case 34: // PG_DOWN
          this._cells.ChangeActiveTool(-1);
            break;
          case 13: // enter
            this._cells.PerformAction()
            break;
        }
      }

      _SetupPointerLock() {
        const hasPointerLock = (
            'pointerLockElement' in document ||
            'mozPointerLockElement' in document ||
            'webkitPointerLockElement' in document);
        if (hasPointerLock) {
          const lockChange = (event) => {
            if (document.pointerLockElement === document.body ||
                document.mozPointerLockElement === document.body ||
                document.webkitPointerLockElement === document.body ) {
              this._enabled = true;
              this._controls.enabled = true;
            } else {
              this._controls.enabled = false;
            }
          };
          const lockError = (event) => {
            console.log(event);
          };

          document.addEventListener('pointerlockchange', lockChange, false);
          document.addEventListener('webkitpointerlockchange', lockChange, false);
          document.addEventListener('mozpointerlockchange', lockChange, false);
          document.addEventListener('pointerlockerror', lockError, false);
          document.addEventListener('mozpointerlockerror', lockError, false);
          document.addEventListener('webkitpointerlockerror', lockError, false);

          document.getElementById('target').addEventListener('click', (event) => {
            document.body.requestPointerLock = (
                document.body.requestPointerLock ||
                document.body.mozRequestPointerLock ||
                document.body.webkitRequestPointerLock);

            if (/Firefox/i.test(navigator.userAgent)) {
              const fullScreenChange = (event) => {
                if (document.fullscreenElement === document.body ||
                    document.mozFullscreenElement === document.body ||
                    document.mozFullScreenElement === document.body) {
                  document.removeEventListener('fullscreenchange', fullScreenChange);
                  document.removeEventListener('mozfullscreenchange', fullScreenChange);
                  document.body.requestPointerLock();
                }
              };
              document.addEventListener(
                  'fullscreenchange', fullScreenChange, false);
              document.addEventListener(
                  'mozfullscreenchange', fullScreenChange, false);
              document.body.requestFullscreen = (
                  document.body.requestFullscreen ||
                  document.body.mozRequestFullscreen ||
                  document.body.mozRequestFullScreen ||
                  document.body.webkitRequestFullscreen);
              document.body.requestFullscreen();
            } else {
              document.body.requestPointerLock();
            }
          }, false);
        }
      }

      _FindIntersections(boxes, position) {
        const sphere = new THREE.Sphere(position, this._radius);

        const intersections = boxes.filter(b => {
          return sphere.intersectsBox(b);
        });

        return intersections;
      }

      Update(timeInSeconds) {
        if (!this._enabled) {
          return;
        }

        const demo = false;
        if (demo) {
          this._controls.getObject().position.x += timeInSeconds * 10;
          return;
        }

        const frameDecceleration = new THREE.Vector3(
            this._velocity.x * this._decceleration.x,
            this._decceleration.y,
            this._velocity.z * this._decceleration.z
        );
        frameDecceleration.multiplyScalar(timeInSeconds);

        this._velocity.add(frameDecceleration);

        if (this._move.forward) {
          this._velocity.z -= this._acceleration.z * timeInSeconds;
        }
        if (this._move.backward) {
          this._velocity.z += this._acceleration.z * timeInSeconds;
        }
        if (this._move.left) {
          this._velocity.x -= this._acceleration.x * timeInSeconds;
        }
        if (this._move.right) {
          this._velocity.x += this._acceleration.x * timeInSeconds;
        }

        const controlObject = this._controls.getObject();
        const cells = this._cells.LookupCells(
            this._controls.getObject().position, 3);
        const boxes = [];
        for (let c of cells) {
          boxes.push(...c.AsBox3Array(this._controls.getObject().position, 3));
        }

        const oldPosition = new THREE.Vector3();
        oldPosition.copy(controlObject.position);

        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(controlObject.quaternion);
        forward.y = 0;
        forward.normalize();

        const sideways = new THREE.Vector3(1, 0, 0);
        sideways.applyQuaternion(controlObject.quaternion);
        sideways.normalize();

        sideways.multiplyScalar(this._velocity.x * timeInSeconds);
        forward.multiplyScalar(this._velocity.z * timeInSeconds);

        controlObject.position.add(forward);
        controlObject.position.add(sideways);

        let intersections = this._FindIntersections(
            boxes, controlObject.position);
        if (intersections.length > 0) {
          controlObject.position.copy(oldPosition);
        }

        oldPosition.copy(controlObject.position);
        controlObject.position.y += this._velocity.y * timeInSeconds;
        intersections = this._FindIntersections(boxes, controlObject.position);
        if (intersections.length > 0) {
          controlObject.position.copy(oldPosition);

          this._velocity.y = Math.max(0, this._velocity.y);
          this._standing = true;
        }

        if (controlObject.position.y < -100) {
          this._velocity.y = 0;
          controlObject.position.y = 150;
          this._standing = true;
        }
      }
    }
  };
})();
