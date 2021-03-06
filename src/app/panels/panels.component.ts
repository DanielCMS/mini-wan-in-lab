import { Component, OnInit, Input } from '@angular/core';
import { PanelRegistry } from '../panel-registry.service';
import { Link, Router, Host, Device, Flow } from '../network-devices';
import { Vector } from '../vector';
 
@Component({
  selector: 'app-panels',
  templateUrl: './panels.component.html',
  styleUrls: ['./panels.component.scss']
})
export class PanelsComponent implements OnInit {

  @Input() canvasOffset: Vector;

  constructor(public panelRegistry: PanelRegistry) { }

  ngOnInit() {
  }

  closePanel(element: Device | Link | Flow) {
    this.panelRegistry.closePanelFor(element);
  }

  bringToTop(element: Device | Link | Flow) {
    this.panelRegistry.bringToTop(element);
  }

}
