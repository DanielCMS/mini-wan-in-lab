import { Component, OnInit, Input, OnChanges, SimpleChanges, EventEmitter, Output } from '@angular/core';
import { Host, Router, Link } from '../network-devices';
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

  private linkTemp: Link;  
  private CanvasStatus = CanvasStatus;

  constructor(private deviceRegistry: DeviceRegistry) {
  }

  ngOnInit() {
  }

}
