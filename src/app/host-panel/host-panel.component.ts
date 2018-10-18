import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Host, FlowStatus } from '../network-devices';
import { Vector } from '../vector';
import { BYTES_PER_MB } from '../constants';
import { processToIp, processToPosInt } from '../processors';

const X_OFFSET = 100;

@Component({
  selector: 'app-host-panel',
  templateUrl: './host-panel.component.html',
  styleUrls: ['./host-panel.component.scss']
})
export class HostPanelComponent implements OnInit {

  @Input() model: Host;
  @Input() canvasOffset: Vector;
  @Output() close = new EventEmitter<void>();

  private anchor: Vector;
  private BYTES_PER_MB = BYTES_PER_MB;
  private FlowStatus = FlowStatus;

  private addingNewFlow: boolean = false;
  private newFlowDest: string = "";
  private newFlowDataAmount: string = "";
  private newFlowCountdown: string = "";

  constructor() { }

  private processToPosInt = processToPosInt;
  private processToIp = processToIp;

  ngOnInit() {
    this.anchor = {
      x: Math.min(this.model.position.x + this.canvasOffset.x + X_OFFSET, window.innerWidth - 230),
      y: Math.min(this.model.position.y + this.canvasOffset.y, window.innerHeight - 230)
    };
  }

  private toggleAddNewFlow(): void {
    this.addingNewFlow = !this.addingNewFlow;
  }

  private closePanel(): void {
    this.close.emit();
  }

  private addNewFlow(): void {
    this.model.addNewFlow(this.newFlowDest, this.newFlowDataAmount, this.newFlowCountdown);
    this.resetNewFlow();
  }

  private resetNewFlow() {
    this.addingNewFlow = false;
    this.newFlowDest = "";
    this.newFlowDataAmount = "";
    this.newFlowCountdown = "";
  }

}
