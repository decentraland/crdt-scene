import { SyncComponent, SynchronizableObservableComponent } from "./system"

@Component("syncstate")
export class DoorOpenComponent extends SynchronizableObservableComponent {
  @DoorOpenComponent.field open: boolean = true
}
