import { Vector } from '../vector';

export class Device {
  public interfaces: Interface[] = [];

  constructor(public id: string, public label: string, public position: Vector) {
  }

  panBy(delta: Vector) {
    this.position = {
      x: this.position.x + delta.x,
      y: this.position.y + delta.y
    };
  }
}

export class Host extends Device {
}

export class Router extends Device {
}

export class Link {
  constructor(public id: string, public src: Device, public dst: Device) {
  }
}

export class Interface {
  port: number;
  srcId: string;
  dstId: string;
}
