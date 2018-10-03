import { Component, OnInit, Input, OnChanges, SimpleChanges, EventEmitter, Output } from '@angular/core';
import { fromEvent, Subject } from 'rxjs';
import { switchMap, takeUntil } from "rxjs/operators";
import { Device, Host, Router, Link } from '../network-devices';
import { Vector } from '../vector';
import { CanvasStatus } from '../canvas-status';
import { DeviceRegistry } from '../device-registry.service';

@Component({
  selector: 'app-network-structure',
  templateUrl: './network-structure.component.html',
  styleUrls: ['./network-structure.component.scss']
})
export class NetworkStructureComponent implements OnInit, OnChanges{

  @Input() canvasOffset: Vector;
  @Input() canvasStatus: CanvasStatus;
  @Input() activeDeviceId: string;

  private linkTemp: Link;
  private tmpDevice: Device;
  private tmpDeviceId: string;
  private targetPosition: Vector;
  private CanvasStatus = CanvasStatus;

  private linkMoveStart$ = new Subject<void>();
  private linkMoveStop$ = new Subject<void>();

  constructor(private deviceRegistry: DeviceRegistry) {
  }

  ngOnInit() {
    let mouseMove$ = fromEvent(document, "mousemove");

    this.linkMoveStart$.pipe(
      switchMap(() => {
        return mouseMove$.pipe(
          takeUntil(this.linkMoveStop$)
        );
      })
    ).subscribe((e: MouseEvent) => {
      this.updateTargetPosition(e);
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    // Reset tmp device during link adding if canvas status changed
    for (let propName in changes) {
      if (propName === "canvasStatus") {
        let currentStatus = changes[propName].currentValue;

        if (currentStatus !== CanvasStatus.AddingLink) {
          this.resetTmpDevice();
        }
      }
    }
  }

  private updateTargetPosition(e: MouseEvent): void {
    this.targetPosition = {
      x: e.pageX - this.canvasOffset.x,
      y: e.pageY - this.canvasOffset.y
    };
  }

  private connectPointClicked(id: string, e: MouseEvent): void {
    if (this.canvasStatus === CanvasStatus.AddingLink) {
      if (this.tmpDevice) {
        this.deviceClicked(id, e);
      } else {
        this.tmpDevice = this.deviceRegistry.getDeviceById(id);
        this.tmpDeviceId = id;

        this.updateTargetPosition(e);
        this.linkMoveStart$.next();
      }
    }
  }

  private deviceEntered(id: string): void {
    if (!this.tmpDevice || id === this.tmpDeviceId) {
      return;
    }

    let target = this.deviceRegistry.getDeviceById(id);

    this.targetPosition = target.position;
    this.linkMoveStop$.next();
  }

  private deviceDetached(id: string, e: MouseEvent): void {
    if (!this.tmpDevice || id === this.tmpDeviceId) {
      return;
    }

    this.updateTargetPosition(e);
    this.linkMoveStart$.next();
  }

  private deviceClicked(id: string, e: MouseEvent): void {
    if (this.canvasStatus !== CanvasStatus.AddingLink || id === this.tmpDeviceId) {
      return;
    }

    if (!this.tmpDevice) {
      this.tmpDevice = this.deviceRegistry.getDeviceById(id);
      this.tmpDeviceId = id;
      this.updateTargetPosition(e);
      this.linkMoveStart$.next();
    } else {
      let target = this.deviceRegistry.getDeviceById(id);

      this.deviceRegistry.addLink(this.tmpDevice, target);
      this.resetTmpDevice();
      this.linkMoveStop$.next();
    }
  }

  private resetTmpDevice(): void {
    this.tmpDevice = null;
    this.tmpDeviceId = null;
  }
}
