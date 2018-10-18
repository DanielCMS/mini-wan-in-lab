import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Link } from '../network-devices';
import { Vector } from '../vector';
import { processToPosInt, processToPercent } from '../processors';

const Y_OFFSET = 100;
const WINDOW_MARGIN = 230;

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
      x: Math.min((this.model.src.position.x + this.model.dst.position.x) / 2 + this.canvasOffset.x, window.innerWidth - WINDOW_MARGIN),
      y: Math.min((this.model.src.position.y + this.model.dst.position.y) / 2 + this.canvasOffset.y + Y_OFFSET, window.innerHeight - WINDOW_MARGIN),
    };
  }

  private closePanel(): void {
    this.close.emit();
  }

  private processToPosInt = processToPosInt;
  private processToPercent = processToPercent;

}
