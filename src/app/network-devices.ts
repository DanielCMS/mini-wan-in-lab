import { Vector } from './vector';

var IPv4 = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/;

export class Device {
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
}

export class Host extends Device {
  public isHost: boolean = true;
  public flowList: Flow[];
  public algorithm: string;

  constructor(public id: string, public label: string, public position: Vector) {
    super(id, label, position);

    this.position = {
      x: this.position.x - 12,
      y: this.position.y + 25
    };
    this.algorithm = "Reno";

    this.flowList = [];
  }

  addNewFlow(dest: string, data: number, startTime: number): void {
    if(IPv4.test(dest) && data > 0 && startTime >= 0){
      this.flowList.push({isFlow: true, flowDestination: dest, dataAmount: data, startTime: startTime});
    } else{
      window.alert('Invalid format: Destination should be a valid IPv4 address. Data should be a positive integer indicating the data amount to send. Status should be a non-negative integer indicating the starting time from now (in seconds).');
    }
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

const DEFAULT_CAP = 10;
const DEFAULT_DELAY = 10;
const DEFAULT_LOSS_RATE = 0.1;

export class Link {
  public isLink: boolean = true;
  public capacity: number = DEFAULT_CAP;
  public delay: number = DEFAULT_DELAY;
  public lossRate: number = DEFAULT_LOSS_RATE;

  constructor(public id: string, public src: Device, public dst: Device) {
  }

  public getOtherEnd(element: Device): Device {
    if (element === this.src) {
      return this.dst;
    } else {
      return this.src;
    }
  }
}

export class Flow {
  public isFlow: boolean = true;
  public flowDestination: string;
  public dataAmount: number;
  public startTime: number;
}

export class Interface {
  constructor(public port: number, public ip: string, public link: Link) {}
}
