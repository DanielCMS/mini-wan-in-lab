import { Component, OnInit } from '@angular/core';
import { Vector } from '../vector';

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements OnInit {
  private offset: Vector = { x: 0, y: 0 };
  private anchor: Vector;
  private last: Vector;
  isCanvasDragging: boolean = false;

  constructor() {}

  ngOnInit() {}

  mouseDown(e: MouseEvent): void {
    if (!(<HTMLElement>e.target).classList.contains("canvas-holder")) {
      return;
    }

    this.anchor = { x: e.pageX, y: e.pageY };
    this.last = this.offset;
    this.isCanvasDragging = true;
  }

  mouseMove(e: MouseEvent): void {
    if (!this.isCanvasDragging) {
      return;
    }

    this.offset = {
      x: this.last.x + e.pageX - this.anchor.x,
      y: this.last.y + e.pageY - this.anchor.y
    };
  }

  mouseUp() {
    this.isCanvasDragging = false;
  }
}
