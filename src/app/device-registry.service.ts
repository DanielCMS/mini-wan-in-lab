import { Injectable } from '@angular/core';
import { Vector } from './vector';
import { Host, Router, Link, Device } from './network-devices';
import { v1 } from 'uuid';

const ACCESS_IP_PREFIX = '192.168.';
const BACKBONE_IP_PREFIX = '10.0.';

@Injectable({
  providedIn: 'root'
})
export class DeviceRegistry {
  public routerList: Router[] = [];
  public hostList: Host[] = [];
  public linkList: Link[] = [];

  private routerLabelCounter: number = 0;
  private hostLabelCounter: number = 0;

  private accessLinkCounter: number = 0;
  private backboneLinkCounter: number = 0;

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
    if (this.isDuplicateLink(src, dst)) {
      console.log("Ignoring duplicate link");

      return;
    }

    let ipPair;

    if (this.isInterRouterLink(src, dst)) {
      ipPair = this.generateInterRouterIpPair();
    } else if (this.isAccessLink(src, dst)) {
      ipPair = this.generateAccessLinkIpPair();
    } else {
      console.log("Ignoring invalid link");

      return;
    }

    let id = v1();
    let newLink = new Link(id, src, dst);

    this.linkList.push(newLink);
    this.linkHashTable[id] = newLink;

    src.attachLink(newLink, ipPair[0]);
    dst.attachLink(newLink, ipPair[1]);
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

  private isDuplicateLink(src: Device, dst: Device): boolean {
    return this.linkList.filter(link => (
      (link.src === src && link.dst === dst)
      || (link.dst === src && link.src === dst)
    )).length > 0;
  }

  private isInterRouterLink(src: Device, dst: Device): boolean {
    return (src instanceof Router) && (dst instanceof Router);
  }

  private isAccessLink(src: Device, dst: Device): boolean {
    return ((src instanceof Router) && (dst instanceof Host)
      || (src instanceof Host) && (dst instanceof Router));
  }

  private generateInterRouterIpPair() {
    this.backboneLinkCounter++;

    return [`${BACKBONE_IP_PREFIX}${this.backboneLinkCounter}.1/24`,
      `${BACKBONE_IP_PREFIX}${this.backboneLinkCounter}.2/24`];
  }

  private generateAccessLinkIpPair(): string[] {
    this.accessLinkCounter++;

    return [`${ACCESS_IP_PREFIX}${this.accessLinkCounter}.1/24`,
      `${ACCESS_IP_PREFIX}${this.accessLinkCounter}.2/24`];
  }
}
