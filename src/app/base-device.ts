import { Vector } from './vector';
import { Device, Link, Interface } from './network-devices';
import { Packet } from './packet';

export class BaseDevice implements Device {
  public interfaces: Interface[] = [];

  private portCounter: number = 0;

  constructor(public id: string, public label: string, public position: Vector) {
  }

  public panBy(delta: Vector): void {
    this.position = {
      x: this.position.x + delta.x,
      y: this.position.y + delta.y
    };
  }

  public attachLink(link: Link, ip: string): void {
    this.portCounter++;
    this.interfaces.push(new Interface(this.portCounter, ip, link));
  }

  public detachLink(link: Link): void {
    this.interfaces = this.interfaces.filter(intf => intf.link !== link);
  }

  public receivePacket(packet: Packet, link: Link): void {}
}
