import { Component, OnInit } from '@angular/core';
import { fromEvent } from 'rxjs';
import { filter, switchMap, takeUntil, map, tap } from "rxjs/operators";
import { Router, Host } from '../network-devices';
import { DeviceRegistry } from '../device-registry.service';
import { PanelRegistry } from '../panel-registry.service';
import { Vector } from '../vector';
import { CanvasStatus } from "../canvas-status";

const CLICK_DELTA = 5;

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements OnInit {

  private mouseDownLocation: Vector;

  private offset: Vector = { x: 0, y: 0 };
  private anchor: Vector;
  private last: Vector;
  private canvasStatus: CanvasStatus = CanvasStatus.Idle;
  private CanvasStatus = CanvasStatus;

  private isCanvasDragging: boolean = false;
  private isDeviceDragging: boolean = false;

  private activeDeviceId: string;
  private idOfDraggingDevice: string;

  constructor(private deviceRegistry: DeviceRegistry,
    private panelRegistry: PanelRegistry) {}

  ngOnInit() {
    this.setupKeyboardEvents();
    this.setupMouseEvents();
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
    this.deviceRegistry.removeElementById(this.activeDeviceId);
    this.canvasStatus = CanvasStatus.Idle;
    this.activeDeviceId = null;
  }

  private setupKeyboardEvents(): void {
    fromEvent(document, 'keydown').subscribe((e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.canvasStatus = CanvasStatus.Idle;
        this.activeDeviceId = null;
      }
    });
  }

  private setupMouseEvents(): void {
    let mousedown$ = fromEvent(document, 'mousedown').pipe(
      filter((e: MouseEvent) => e.button === 0),
      filter((e: MouseEvent) => {
        let target = <HTMLElement>e.target;
        let classList = (<HTMLElement>e.target).classList;

        return classList.contains("svg-bg") || classList.contains("topology-elements")
          || classList.contains("link-handle");
      }),
      tap((e: MouseEvent) => {
        this.mouseDownLocation = {
          x: e.pageX,
          y: e.pageY
        };
        this.mouseDown(e);
      })
    );
    let mousemove$ = fromEvent(document, 'mousemove');
    let mouseup$ = fromEvent(document, 'mouseup').pipe(
      tap((e: MouseEvent) => {
        if (Math.abs(e.pageX - this.mouseDownLocation.x) < CLICK_DELTA
          && Math.abs(e.pageY - this.mouseDownLocation.y) < CLICK_DELTA) {
          this.mouseClick(e);
        }

        this.mouseUp();
      })
    );

    let mousedrag$ = mousedown$.pipe(
      switchMap(() => mousemove$.pipe(
        takeUntil(mouseup$)
      ))
    ).subscribe((e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      requestAnimationFrame(() => {
        this.mouseMove(e);
      });
    });
  }

  private mouseDown(e: MouseEvent): void {
    let target = <HTMLElement>e.target;
    let classList = target.classList;

    if (classList.contains("svg-bg")) {
      this.anchor = { x: e.pageX, y: e.pageY };
      this.last = {
        x: this.offset.x,
        y: this.offset.y
      };
      this.isCanvasDragging = true;
    } else if (classList.contains("topology-elements")) {
      let id = target.id;

      this.last = { x: e.pageX, y: e.pageY };
      this.idOfDraggingDevice = id;
      this.isDeviceDragging = true;
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
    this.isDeviceDragging = false;
  }

  private mouseClick(e: MouseEvent): void {
    let target = <HTMLElement>e.target;
    let classList = target.classList;

    if (classList.contains("svg-bg")) {
      let pageLocation = { x: e.pageX, y: e.pageY };
      let normalized = this.normalizePoint(pageLocation);

      if (this.canvasStatus === CanvasStatus.AddingRouter) {
        this.deviceRegistry.addRouter(normalized);
      } else if (this.canvasStatus === CanvasStatus.AddingHost) {
        this.deviceRegistry.addHost(normalized);
      } else {
        this.activeDeviceId = null;
      }

      return;
    }

    if (classList.contains("topology-elements") && this.canvasStatus === CanvasStatus.AddingLink) {
        return;
    }

    let element = this.deviceRegistry.getElementById(target.id);

    this.activeDeviceId = target.id;
    this.panelRegistry.openPanelFor(element);
    this.canvasStatus = CanvasStatus.Idle;
  }

  // Transform screen pixel coordinates to un-offset version
  private normalizePoint(v: Vector): Vector {
    return {
      x: v.x - this.offset.x,
      y: v.y - this.offset.y
    }
  }
}
