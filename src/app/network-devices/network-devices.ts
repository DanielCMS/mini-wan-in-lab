import { Vector } from '../vector';

export class Host {
  id: number;
  x: number;
  y: number;
}

export class Router {
  id: number;
  x: number;
  y: number;
}

export class Link {
  id: number;
  firstNodePos: Vector;
  secondNodePos: Vector;
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