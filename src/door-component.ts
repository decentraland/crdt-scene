import { SynchronizableObservableComponent } from "./sync-component";

@Component("syncstate")
export class DoorOpenComponent extends SynchronizableObservableComponent {
  @DoorOpenComponent.field open: boolean = true
}
