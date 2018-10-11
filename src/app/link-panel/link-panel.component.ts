import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Link } from '../network-devices';
import { Vector } from '../vector';

const Y_OFFSET = 100;

@Component({
  selector: 'app-link-panel',
  templateUrl: './link-panel.component.html',
  styleUrls: ['./link-panel.component.scss']
})
export class LinkPanelComponent implements OnInit {

  @Input() model: Link;
  @Input() canvasOffset: Vector;
  @Output() close = new EventEmitter<void>();

  private anchor: Vector;
  private window = window;

  constructor() { }

  ngOnInit() {
    this.anchor = {
      x: Math.min((this.model.src.position.x + this.model.dst.position.x) / 2 + this.canvasOffset.x, window.innerWidth - 230),
      y: Math.min((this.model.src.position.y + this.model.dst.position.y) / 2 + this.canvasOffset.y + Y_OFFSET, window.innerHeight - 230),
    };
  }

  private closePanel(): void {
    this.close.emit();
  }

  private processToPosInt(input: string, fallback: string): string {
    let normalized = parseInt(input);

    if (!isNaN(normalized) && normalized > 0) {
      return normalized.toString();
    } else {
      return fallback;
    }
  }

  private processToPercent(input: string, fallback: string): string {
    let normalized = parseFloat(input);

    if (isNaN(normalized)) {
      return fallback;
    } else {
      return Math.max(Math.min(normalized, 100), 0).toString();
    }
  }

}
