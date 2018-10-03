import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '../network-devices';
import { Vector } from '../vector';

const X_OFFSET = 100;

@Component({
  selector: 'app-router-panel',
  templateUrl: './router-panel.component.html',
  styleUrls: ['./router-panel.component.scss']
})
export class RouterPanelComponent implements OnInit {

  @Input() model: Router;
  @Input() canvasOffset: Vector;
  @Output() close = new EventEmitter<void>();

  private anchor: Vector;

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
