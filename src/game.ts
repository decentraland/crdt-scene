import { DoorOpenComponent } from "./sync-component"
import { CRDTSystem } from "./system"

type Door = { open: boolean }

engine.addSystem(new CRDTSystem("wss://test-sfu.decentraland.zone"))

let openPos: Quaternion = Quaternion.Euler(0, 90, 0)
let closedPos: Quaternion = Quaternion.Euler(0, 0, 0)

// Define fixed walls
const wall1 = new Entity()
wall1.addComponent(
  new Transform({
    position: new Vector3(5.75, 1, 3),
    scale: new Vector3(1.5, 2, 0.05),
  })
)
wall1.addComponent(new BoxShape())
engine.addEntity(wall1)

const wall2 = new Entity()
wall2.addComponent(
  new Transform({
    position: new Vector3(3.25, 1, 3),
    scale: new Vector3(1.5, 2, 0.05),
  })
)
wall2.addComponent(new BoxShape())
engine.addEntity(wall2)

// Add actual door to scene. This entity doesn't rotate, its parent drags it with it.
const door = new Entity()
door.addComponent(
  new Transform({
    position: new Vector3(0.5, 0, 0),
    scale: new Vector3(1, 2, 0.05),
  })
)
door.addComponent(new BoxShape())
engine.addEntity(door)

// Define a material to color the door red
const doorMaterial = new Material()
doorMaterial.albedoColor = Color3.Red()
doorMaterial.metallic = 0.9
doorMaterial.roughness = 0.1

// Assign the material to the door
door.addComponent(doorMaterial)

// Define wrapper entity to rotate door. This is the entity that actually rotates.
const doorPivot = new Entity()
doorPivot.addComponent(
  new Transform({
    position: new Vector3(4, 1, 3),
    rotation: closedPos,
  })
)
//doorPivot.addComponent(new DoorState())
engine.addEntity(doorPivot)

// Set the door as a child of doorPivot
door.setParent(doorPivot)

door.getComponentOrCreate(DoorOpenComponent)

class OpenerSystem {
  entitites = engine.getComponentGroup(DoorOpenComponent, Transform)
  update(dt: number) {
    for (const entity of this.entitites.entities) {
      const openComponent = entity.getComponent(DoorOpenComponent)
      const transform = entity.getComponent(Transform)
      transform.rotation = openComponent.open ? openPos : closedPos
    }
  }
}

engine.addSystem(new OpenerSystem())

// Set the click behavior for the door
door.addComponent(
  new OnPointerDown(
    (e) => {
      const component = door.getComponent(DoorOpenComponent)
      component.open = !component.open
    },
    { button: ActionButton.POINTER, hoverText: "Open/Close" }
  )
)
