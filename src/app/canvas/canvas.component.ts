import { Component, OnInit } from '@angular/core';
import { DeviceRegistry } from '../device-registry.service';
import { PanelRegistry } from '../panel-registry.service';
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

  private devicePlacement: Vector;
  private isPlacingRouter: boolean = false;
  private isPlacingHost: boolean = false;

  constructor(private deviceRegistry: DeviceRegistry,
    private panelRegistry: PanelRegistry) {}

  ngOnInit() {}

  private requestAddingRouter(): void {
    this.canvasStatus = CanvasStatus.AddingRouter;
  }

  private requestAddingHost(): void {
    this.canvasStatus = CanvasStatus.AddingHost;
  }

  private requestAddingLink(): void {
    this.canvasStatus = CanvasStatus.AddingLink;
  }

  private requestDeleting(): void {
    this.canvasStatus = CanvasStatus.Idle;
  }

  private mouseDown(e: MouseEvent): void {
    if (!(<HTMLElement>e.target).classList.contains("canvas-holder") && !(<HTMLElement>e.target).classList.contains("svg-bg")) {
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

  // Transform screen pixel coordinates to un-offset version
  private normalizePoint(v: Vector): Vector {
    return {
      x: v.x - this.offset.x,
      y: v.y - this.offset.y
    }
  }

  private placeDevice(e: MouseEvent) {
    if (!(<HTMLElement>e.target).classList.contains("svg-bg")) {
      return;
    }

    let pageLocation = { x: e.pageX, y: e.pageY };
    let normalized = this.normalizePoint(pageLocation);

    if (this.canvasStatus == CanvasStatus.AddingRouter) {
      this.deviceRegistry.addRouter(normalized);
      this.canvasStatus = CanvasStatus.Idle;
    }

    if (this.canvasStatus == CanvasStatus.AddingHost) {
      this.devicePlacement = { x: e.pageX, y: e.pageY };
      this.isPlacingHost = true;
    }
  }
  
  private finishAddingDevice(): void {
    requestAnimationFrame(() => {
      this.isPlacingHost = false;
      this.isPlacingRouter = false;
      this.canvasStatus = CanvasStatus.Idle;
    });
  }

}
