import { Injectable } from '@angular/core';
import { Vector } from './vector';
import { Host, Router, Link, Device } from './network-devices';
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
  private deviceHashTable: { [id: string]: Device } = {};
  private linkHashTable: { [id: string]: Link } = {}; 

  constructor() { 
  }

  public addRouter(position: Vector): void {
    let id = v1();
    let label = `Router ${this.routerLabelCounter}`;
    let newRouter = new Router(id, label, position);

    this.routerLabelCounter++;

    this.routerList.push(newRouter);
    this.deviceHashTable[id] = newRouter;
  }

  public addHost(position: Vector): void {
    let id = v1();
    let label = `Host ${this.hostLabelCounter}`;
    let newHost = new Host(id, label, position);

    this.hostLabelCounter++;

    this.hostList.push(newHost);
    this.deviceHashTable[id] = newHost;
  }

  public addLink(src: Device, dst: Device): void {
    let id = v1();
    let newLink = new Link(id, src, dst);

    this.linkList.push(newLink);
    this.linkHashTable[id] = newLink;
  }

  public getDeviceById(id: string): Device {
    return this.deviceHashTable[id];
  }

  public getLinkById(id: string): Link {
    return this.linkHashTable[id];
  }

  public getElementById(id: string): Device | Link {
    return this.getDeviceById(id) || this.getLinkById(id);
  }
}
