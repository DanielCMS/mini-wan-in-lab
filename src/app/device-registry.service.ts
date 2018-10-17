import { Injectable } from '@angular/core';
import { Vector } from './vector';
import { Host, Router, Link, Device, isDevice, isHost, isRouter, isLink } from './network-devices';
import { HostProvider } from './host';
import { RouterProvider } from './router';
import { LinkProvider } from './link';
import { v4 } from 'uuid';
import { PanelRegistry } from './panel-registry.service';
import { FeedbackService } from './feedback.service';


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

  constructor(private panelRegistry: PanelRegistry, private feedback: FeedbackService) {
  }

  public addRouter(position: Vector): void {
    let id = v4();
    let label = `Router ${this.routerLabelCounter}`;
    let newRouter = new RouterProvider(id, label, position);

    this.routerLabelCounter++;

    this.routerList.push(newRouter);
    this.deviceHashTable[id] = newRouter;
  }

  public addHost(position: Vector): void {
    let id = v4();
    let label = `Host ${this.hostLabelCounter}`;
    let newHost = new HostProvider(id, label, position);

    this.hostLabelCounter++;

    this.hostList.push(newHost);
    this.deviceHashTable[id] = newHost;
  }

  public addLink(src: Device, dst: Device): void {
    if (this.isDuplicateLink(src, dst)) {
      this.feedback.sendError("The link to add already exists.");

      return;
    }

    let ipPair;

    if (this.isInterRouterLink(src, dst)) {
      ipPair = this.generateInterRouterIpPair();
    } else if (this.isAccessLink(src, dst)) {
      if (isHost(src) && (src.interfaces.length > 0)) {
        this.feedback.sendError("A host cannot have two gateways.");

        return;
      }

      if (isHost(dst) && (dst.interfaces.length > 0)) {
        this.feedback.sendError("A host cannot have two gateways.");

        return;
      }

      ipPair = this.generateAccessLinkIpPair();
    } else {
      this.feedback.sendError("Two hosts cannot be directly connected.");

      return;
    }

    let id = v4();
    let newLink = new LinkProvider(id, src, dst);

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

  public removeElementById(id: string): void {
    let element = this.getElementById(id);

    this.panelRegistry.closePanelFor(element);

    if (isDevice(element)) {
      for (let intf of element.interfaces) {
        this.removeElementById(intf.link.id);
      }

      if (isHost(element)) {
        let idx = this.hostList.indexOf(element);

        this.hostList.splice(idx, 1);
      } else if (isRouter(element)) {
        let idx = this.routerList.indexOf(element);

        this.routerList.splice(idx, 1);
      }
    } else if (isLink(element)) {
      let idx = this.linkList.indexOf(element);

      this.linkList.splice(idx, 1);
      element.cleanUp();

      for (let node of [element.src, element.dst]) {
        node.detachLink(element);
      }
    }
  }

  private isDuplicateLink(src: Device, dst: Device): boolean {
    return this.linkList.filter(link => (
      (link.src === src && link.dst === dst)
      || (link.dst === src && link.src === dst)
    )).length > 0;
  }

  private isInterRouterLink(src: Device, dst: Device): boolean {
    return isRouter(src) && isRouter(dst);
  }

  private isAccessLink(src: Device, dst: Device): boolean {
    return (isRouter(src) && isHost(dst))
      || (isHost(src) && isRouter(dst));
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
