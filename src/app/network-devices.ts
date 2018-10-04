import { Vector } from './vector';
import jsgraphs from 'js-graph-algorithms');

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

  constructor(public id: string, public label: string, public position: Vector) {
    super(id, label, position);

    this.position = {
      x: this.position.x - 12,
      y: this.position.y + 25
    };
  }

  public getIp(): string {
    return this.interfaces[0].ip;
  }
}

export class Router extends Device {
  public isRouter: boolean = true;
  private lsdb: Link[] = [];
  private routingTable: Route[] = [];

  constructor(public id: string, public label: string, public position: Vector) {
    super(id, label, position);

    this.position = {
      x: this.position.x - 22,
      y: this.position.y + 25
    };
  }

  public attachLink(link: Link, ip: string): void {
    super.attachLink(link, ip);

    if (this.lsdb.indexOf(link) < 0) {
      this.lsdb.push(link);
    }

    setTimeout(() => {
      this.advertiseNewLink(link);
      this.updateRoutingTable();
    });
  }

  public advertiseNewLink(link: Link): void {
  }

  public advertiseLinkRemoval(link: Link): void {
  }

  public updateRoutingTable(): void {
    let knownHostList: Host[] = [];
    let idToIdx = {};
    let idxToDevice = {};
    let idxCounter = 0;

    for (let link of this.lsdb) {
      for (let node of [link.src, link.dst]) {
        if (idToIdx[node.id]) {
          continue;
        }

        if (node instanceof Host) {
          knownHostList.push(node);
        }

        idToIdx[node.id] = idxCounter;
        idxToDevice[idxCounter] = node;
        idxCounter++;
      }
    }

    let graph = new jsgraphs.WeightedGraph(idxCounter);

    for (let link of this.lsdb) {
      let srcIdx = idToIdx[link.src.id];
      let dstIdx = idToIdx[link.dst.id];

      graph.addEdge(new jsgraphs.Edge(srcIdx, dstIdx, link.metric));
    }

    let dijkstra = new jsgraphs.Dijkstra(graph, idToIdx[this.id]);
    let routingTable: Route[] = [];

    for (let host of knownHostList) {
      let firstHop = dijkstra.pathTo(idToIdx[host.id])[0];
      let nextHop = idxToDevice[firstHop.to()];

      routingTable.push(new Route(host.getIp(), nextHop));
    }

    this.routingTable = routingTable;
  }
}

const DEFAULT_CAP = 10;
const DEFAULT_DELAY = 10;
const DEFAULT_LOSS_RATE = 0.1;
const DEFAULT_BUFFER_SIZE = 64;
const DEFAULT_METRIC = 1;

export class Link {
  public isLink: boolean = true;
  public capacity: number = DEFAULT_CAP;
  public delay: number = DEFAULT_DELAY;
  public lossRate: number = DEFAULT_LOSS_RATE;
  public bufferSize: number = DEFAULT_BUFFER_SIZE;
  public metric: number = DEFAULT_METRIC;

  constructor(public id: string, public src: Device, public dst: Device) {
  }

  public getOtherEnd(element: Device): Device {
    if (element === this.src) {
      return this.dst;
    } else {
      return this.src;
    }
  }

  public getHostIfPresent(): (Host | void) {
    if (this.src instanceof Host) {
      return this.src;
    } else if (this.dst instanceof Host) {
      return this.dst;
    }
  }
}

export class Interface {
  constructor(public port: number, public ip: string, public link: Link) {}
}

export class Route {
  constructor(public ip: string, public nextHop: Device) {}
}
