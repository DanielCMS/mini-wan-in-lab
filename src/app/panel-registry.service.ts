import { Injectable } from '@angular/core';
import { Device, Link } from './network-devices';

@Injectable({
  providedIn: 'root'
})
export class PanelRegistry {

  public panels: (Device | Link)[] = [];

  constructor() { }

  openPanelFor(element: Device | Link) {
    this.closePanelFor(element);
    this.panels.push(element);
  }

  closePanelFor(element: Device | Link) {
    let index = this.panels.indexOf(element);

    if (index >= 0) {
      this.panels.splice(index, 1);
    }
  }
}
