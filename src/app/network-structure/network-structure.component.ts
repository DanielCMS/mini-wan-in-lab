import { Component, OnInit, Input, OnChanges, SimpleChanges, EventEmitter, Output } from '@angular/core';
import { Host, Router, Link, AddLinkStatus } from '../network-devices/network-devices';
import { Vector } from '../vector';
import { CanvasStatus } from '../canvas-status';
import { DeviceRegistry } from '../device-registry.service';

@Component({
  selector: 'app-network-structure',
  templateUrl: './network-structure.component.html',
  styleUrls: ['./network-structure.component.scss']
})
export class NetworkStructureComponent implements OnInit, OnChanges{

  @Input() canvasOffset: Vector;
  @Input() isPlacingRouter: boolean;
  @Input() isPlacingHost: boolean;
  @Input() deviceLocation: Vector;
  @Input() canvasStatus: CanvasStatus;
  @Output() finishAdding = new EventEmitter<void>();

  private routerList: Router[] = [];
  private hostList: Host[] = [];
  private linkList: Link[] = [];
  private routerIdCounter: number = 0;
  private hostIdCounter: number = 0;
  private linkIdCounter: number = 0;
  private selectedRouter: Router;
  private selectedHost: Host;
  private addLinkStatus: AddLinkStatus = AddLinkStatus.Idle;
  private linkTemp: Link;  

  ngOnChanges(changes: SimpleChanges) {
    if(this.isPlacingRouter) {
      this.routerList.push({
        id: this.routerIdCounter,
        x: this.deviceLocation.x,
        y: this.deviceLocation.y
      });
      this.routerIdCounter++;
      this.finishAdding.emit();
    } else if(this.isPlacingHost) {
      this.hostList.push({
        id: this.hostIdCounter,
        x: this.deviceLocation.x,
        y: this.deviceLocation.y
      });
      this.hostIdCounter++;
      this.finishAdding.emit();
    }
    if(this.canvasStatus == CanvasStatus.AddingLink){
      if(this.addLinkStatus == AddLinkStatus.Idle){
        this.addLinkStatus = AddLinkStatus.Ready;
      }
    } else {
      this.addLinkStatus = AddLinkStatus.Idle;
    }
  }

  onSelect(router: Router): void {
    if(this.selectedRouter != router){
      this.selectedRouter = router;
      switch(this.addLinkStatus) {
        case AddLinkStatus.Ready:
          this.linkTemp = {
            id: this.linkIdCounter,
            firstNodePos: {
              x: router.x + 18,
              y: router.y + 18
            },
            secondNodePos: {
              x: router.x + 18,
              y: router.y + 18
            }
          };
          this.addLinkStatus = AddLinkStatus.FisrtNodeSelected;
          break;
        case AddLinkStatus.FisrtNodeSelected:
          this.linkTemp.secondNodePos = {
            x: router.x + 18,
            y: router.y + 18
          };
          this.linkList.push(this.linkTemp);
          this.addLinkStatus = AddLinkStatus.Idle;
          this.finishAdding.emit();
          break;
        case AddLinkStatus.SecondNodeSelected:
          break;
        default:
          break;
      }
    } else {
      this.selectedRouter = {
        id: -1,
        x: 0,
        y: 0
      };
    }
  }

  constructor(private deviceRegistry: DeviceRegistry) {
  }

  ngOnInit() {
  }

}
