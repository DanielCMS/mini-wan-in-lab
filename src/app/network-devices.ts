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
  constructor(public id: string, public label: string, public position: Vector) {
    let offsetPosition = {
      x: position.x - 12,
      y: position.y + 25
    };

    super(id, label, offsetPosition);
  }
}

export class Router extends Device {
  constructor(public id: string, public label: string, public position: Vector) {
    let offsetPosition = {
      x: position.x - 22,
      y: position.y + 25
    };

    super(id, label, offsetPosition);
  }
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
