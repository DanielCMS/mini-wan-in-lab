import { Component, OnInit, Input } from '@angular/core';
import { CanvasStatus } from '../canvas-status.ts';

@Component({
  selector: 'app-controls',
  templateUrl: './controls.component.html',
  styleUrls: ['./controls.component.scss']
})
export class ControlsComponent implements OnInit {
  @Input() canvasStatus: CanvasStatus;

  CanvasStatus = CanvasStatus;

  constructor() { }

  ngOnInit() {
  }

  addRouter(): void {
    console.log("Adding router");
  }

  addHost(): void {
    console.log("Adding host");
  }

  delete(): void {
    console.log("Deleting");
  }
}
