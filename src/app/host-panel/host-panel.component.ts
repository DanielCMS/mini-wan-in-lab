import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Host, Flow, FlowStatus, AlgType } from '../network-devices';
import { PanelRegistry } from '../panel-registry.service';
import { Vector } from '../vector';
import { BYTES_PER_MB } from '../constants';
import { processToIp, processToNonnegInt, processToPos } from '../processors';

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

  private addingNewFlow: boolean;
  private newFlowDest: string;
  private newFlowDataAmount: string;
  private newFlowCountdown: string;
  private newFlowAlg: string;
  private algs: string[];

  constructor(private panelRegistry: PanelRegistry) { }

  private processToNonnegInt = processToNonnegInt;
  private processToPos = processToPos;
  private processToIp = processToIp;

  ngOnInit() {
    this.anchor = {
      x: Math.min(this.model.position.x + this.canvasOffset.x + X_OFFSET, window.innerWidth - 230),
      y: Math.min(this.model.position.y + this.canvasOffset.y, window.innerHeight - 230)
    };
    this.algs = Object.keys(AlgType);
    this.resetNewFlow();
  }

  private toggleAddNewFlow(): void {
    this.addingNewFlow = !this.addingNewFlow;
  }

  private openFlowPanel(flow: Flow): void {
    this.panelRegistry.openPanelFor(flow);
  }

  private closePanel(): void {
    this.close.emit();
  }

  private addNewFlow(): void {
    this.model.addNewFlow(this.newFlowDest, +this.newFlowDataAmount, <AlgType>this.newFlowAlg, +this.newFlowCountdown);
    this.resetNewFlow();
  }

  private resetNewFlow() {
    this.addingNewFlow = false;
    this.newFlowDest = "";
    this.newFlowDataAmount = "5";
    this.newFlowCountdown = "5";
    this.newFlowAlg = this.algs[0];
  }

}
