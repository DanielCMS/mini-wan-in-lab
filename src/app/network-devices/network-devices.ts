import { Vector } from '../vector';

export class Host {
  id: number;
  x: number;
  y: number;
}

export class Router {
  public interfaces: Interface[] = [];

  constructor(public id: string, public label: string, public position: Vector) {
  }
}

export class Link {
  id: number;
  firstNodePos: Vector;
  secondNodePos: Vector;
}

export class Interface {
  port: number;
  srcId: string;
  dstId: string;
}

export enum AddLinkStatus {
  Idle,
  Ready,
  FisrtNodeSelected,
  SecondNodeSelected
}

export enum DeviceType {
  Router,
  Host
}
