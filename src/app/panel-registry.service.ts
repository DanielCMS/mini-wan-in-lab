import { Injectable } from '@angular/core';
import { Device, Link } from './network-devices';

@Injectable({
  providedIn: 'root'
})
export class PanelRegistry {

  public panels: (Device | Link)[] = [];

  constructor() { }

  openPanelFor(element: Device | Link) {
    this.panels.push(element);
  }
}
