import { Injectable } from '@angular/core';
import { Device, Link, Flow } from './network-devices';

@Injectable({
  providedIn: 'root'
})
export class PanelRegistry {

  public panels: (Device | Link | Flow)[] = [];

  constructor() { }

  bringToTop(element: Device | Link | Flow) {
    this.openPanelFor(element);
  }

  openPanelFor(element: Device | Link | Flow) {
    this.closePanelFor(element);
    this.panels.push(element);
  }

  closePanelFor(element: Device | Link | Flow) {
    let index = this.panels.indexOf(element);

    if (index >= 0) {
      this.panels.splice(index, 1);
    }
  }
}
