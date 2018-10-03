import { Vector } from './vector';

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
  public isHost: boolean = true;

  constructor(public id: string, public label: string, public position: Vector) {
    super(id, label, position);

    this.position = {
      x: this.position.x - 12,
      y: this.position.y + 25
    };
  }
}

export class Router extends Device {
  public isRouter: boolean = true;

  constructor(public id: string, public label: string, public position: Vector) {
    super(id, label, position);

    this.position = {
      x: this.position.x - 22,
      y: this.position.y + 25
    };
  }
}

export class Link {
  public isLink: boolean = true;

  constructor(public id: string, public src: Device, public dst: Device) {
  }
}

export class Interface {
  port: number;
  srcId: string;
  dstId: string;
}
