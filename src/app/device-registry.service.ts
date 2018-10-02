import { Injectable } from '@angular/core';
import { Vector } from './vector';
import { Host, Router, Link } from './network-devices';
import { v1 } from 'uuid';

@Injectable({
  providedIn: 'root'
})
export class DeviceRegistry {
  public routerList: Router[] = [];
  public hostList: Host[] = [];
  public linkList: Link[] = [];
  private routerLabelCounter: number = 0;
  private hostLabelCounter: number = 0;
  private linkLabelCounter: number = 0;

  constructor() { 
  }

  public addRouter(location: Vector): void {
    let id = v1();
    let label = `Router ${this.routerLabelCounter}`;

    this.routerLabelCounter++;

    this.routerList.push(new Router(id, label, location));
  }

  public addHost(location: Vector): void {
    let id = v1();
    let label = `Host ${this.routerLabelCounter}`;

    this.hostLabelCounter++;

    this.hostList.push(new Router(id, label, location));
  }
}
