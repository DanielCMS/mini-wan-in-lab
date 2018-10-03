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

  constructor() { }

  ngOnInit() {
    this.anchor = {
      x: (this.model.src.position.x + this.model.dst.position.x) / 2 + this.canvasOffset.x,
      y: (this.model.src.position.y + this.model.dst.position.y) / 2 + this.canvasOffset.y + Y_OFFSET
    };
  }

  private closePanel(): void {
    this.close.emit();
  }

}
