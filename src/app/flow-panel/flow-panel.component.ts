import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Flow, AlgType } from '../network-devices';
import { BYTES_PER_MB } from '../constants';
import { Vector } from '../vector';

const Y_OFFSET = 100;
const IPv4 = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/;
const WINDOW_MARGIN = 230;

@Component({
  selector: 'app-flow-panel',
  templateUrl: './flow-panel.component.html',
  styleUrls: ['./flow-panel.component.scss']
})
export class FlowPanelComponent implements OnInit {

  @Input() model: Flow;
  @Input() canvasOffset: Vector;
  @Output() close = new EventEmitter<void>();

  private anchor: Vector;
  private window = window;
  private algs: string[] = Object.keys(AlgType);
  private BYTES_PER_MB = BYTES_PER_MB;

  constructor() { }

  ngOnInit() {
    this.anchor = {
      x: Math.min(this.model.sendingHost.position.x + this.canvasOffset.x, window.innerWidth - WINDOW_MARGIN),
      y: Math.min(this.model.sendingHost.position.y + this.canvasOffset.y + Y_OFFSET, window.innerHeight - WINDOW_MARGIN),
    };
  }

  private closePanel(): void {
    this.close.emit();
  }

  private processToIp(input: string, fallback: string): string {
    if (IPv4.test(input)) {
      return input;
    } else {
      return fallback;
    }
  }

  private processToPosInt(input: string, fallback: string): string {
    let normalized = parseInt(input);

    if (!isNaN(normalized) && normalized > 0) {
      return normalized.toString();
    } else {
      return fallback;
    }
  }

}
