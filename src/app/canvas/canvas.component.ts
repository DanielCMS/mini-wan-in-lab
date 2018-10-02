import { Component, OnInit } from '@angular/core';
import { fromEvent } from 'rxjs';
import { filter, switchMap, takeUntil, map } from "rxjs/operators";
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
  private isDeviceDragging: boolean = false;

  private devicePlacement: Vector;
  private isPlacingRouter: boolean = false;
  private isPlacingHost: boolean = false;

  constructor(private deviceRegistry: DeviceRegistry,
    private panelRegistry: PanelRegistry) {}

  ngOnInit() {
    this.setupEvents();
  }

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

  private setupEvents(): void {
    let mousedown$ = fromEvent(document, 'mousedown');
    let mousemove$ = fromEvent(document, 'mousemove');
    let mouseup$ = fromEvent(document, 'mouseup').pipe(
      map((e: MouseEvent) => {
        this.mouseUp();

        return e;
      }),
    );

    let mousedrag$ = mousedown$.pipe(
      filter((e: MouseEvent) => e.button === 0),
      switchMap((e: MouseEvent) => {
        this.mouseDown(e);

        return mousemove$.pipe(
          takeUntil(mouseup$)
        );
      })
    ).subscribe((e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      requestAnimationFrame(() => {
        this.mouseMove(e);
      });
    }
  }

  private mouseDown(e: MouseEvent): void {
    let target = <HTMLElement>e.target;
    let classList = target.classList;

    if (classList.contains("svg-bg")) {
      this.anchor = { x: e.pageX, y: e.pageY };
      this.last = this.offset;
      this.isCanvasDragging = true;
    } else if (classList.contains("topology-elements")) {
      let id = target.id;

      if (this.canvasStatus === CanvasStatus.AddingLink) {
      } else {
        this.last = { x: e.pageX, y: e.pageY };
        this.idOfDraggingDevice = id;
        this.isDeviceDragging = true;
      }
    }
  }

  private mouseMove(e: MouseEvent): void {
    if (this.isCanvasDragging) {
      this.offset = {
        x: this.last.x + e.pageX - this.anchor.x,
        y: this.last.y + e.pageY - this.anchor.y
      };
    } else if (this.isDeviceDragging) {
      let delta = {
        x: e.pageX - this.last.x,
        y: e.pageY - this.last.y
      };
      let id = this.idOfDraggingDevice;

      this.deviceRegistry.getDeviceById(id).panBy(delta);
      this.last = {
        x: e.pageX,
        y: e.pageY
      };
    }
  }

  private mouseUp(): void {
    this.isCanvasDragging = false;
    this.idDeviceDragging = false;
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
      this.deviceRegistry.addHost(normalized);
      this.canvasStatus = CanvasStatus.Idle;
    }
  }

}
