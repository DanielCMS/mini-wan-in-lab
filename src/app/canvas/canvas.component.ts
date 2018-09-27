import { Component, OnInit } from '@angular/core';
import { Vector } from '../vector';
import { CanvasStatus } from "../canvas-status";

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements OnInit {
  private offset: Vector = { x: 0, y: 0 };
  private anchor: Vector;
  private last: Vector;
  private canvasStatus: CanvasStatus = CanvasStatus.Idle;
  private CanvasStatus = CanvasStatus;
  private isCanvasDragging: boolean = false;

  constructor() {}

  ngOnInit() {}

  private requestAddingRouter(): void {
    this.canvasStatus = CanvasStatus.AddingRouter;
  }

  private requestAddingHost(): void {
    this.canvasStatus = CanvasStatus.AddingHost;
  }

  private requestDeleting(): void {
    this.canvasStatus = CanvasStatus.Idle;
  }

  private mouseDown(e: MouseEvent): void {
    if (!(<HTMLElement>e.target).classList.contains("canvas-holder")) {
      return;
    }

    this.anchor = { x: e.pageX, y: e.pageY };
    this.last = this.offset;
    this.isCanvasDragging = true;
  }

  private mouseMove(e: MouseEvent): void {
    if (!this.isCanvasDragging) {
      return;
    }

    this.offset = {
      x: this.last.x + e.pageX - this.anchor.x,
      y: this.last.y + e.pageY - this.anchor.y
    };
  }

  private mouseUp() {
    this.isCanvasDragging = false;
  }
}
