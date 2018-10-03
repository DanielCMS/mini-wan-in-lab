import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Host } from '../network-devices';
import { Vector } from '../vector';

const X_OFFSET = 100;
const TCP_ALGS = ["Reno", "Vegas", "FAST"];

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
  private tcpAlgs: string[] = TCP_ALGS;

  constructor() { }

  ngOnInit() {
    this.anchor = {
      x: this.model.position.x + this.canvasOffset.x + X_OFFSET,
      y: this.model.position.y + this.canvasOffset.y
    };
  }

  private closePanel(): void {
    this.close.emit();
  }

}
