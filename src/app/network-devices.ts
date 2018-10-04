import { Subject } from 'rxjs';
import { Vector } from './vector';
import * as jsgraphs from 'js-graph-algorithms';
import * as Deque from 'double-ended-queue';
import { TIME_SLOWDOWN, BROADCAST_IP, OSPF_SIZE } from './constants';

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

  public receivePacket(packet: Packet, link: Link): void {}
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
    let gateway = this.interfaces[0];

    if (gateway) {
      return gateway.ip;
    } else {
      return 'N/A';
    }
  }

  public receivePacket(packet: Packet, link: Link): void {
    if (packet.dstIp !== this.getIp()) {
      return;
    }

    // Send ack packet here
  }

  public sendPacket(packet: Packet): void {
    let gateway = this.interfaces[0];

    if (gateway) {
      gateway.link.sendPacketFrom(this, packet);
    } else {
      console.log(`Dropping packet at ${this.label} due to missing gateway.`);
    }
  }
}

const BROADCAST_CACHE_INTERVAL = 60000; // 1min

export class Router extends Device {
  public isRouter: boolean = true;
  private lsdb: Link[] = [];
  private routingTable: Route[] = [];
  private fib: { [ip: string]: Link } = {};

  private cachedBroadcastPkt: Packet[] = [];

  constructor(public id: string, public label: string, public position: Vector) {
    super(id, label, position);

    this.position = {
      x: this.position.x - 22,
      y: this.position.y + 25
    };
  }

  public forwardPacket(packet: Packet): void {
    let link = this.fib[packet.dstIp];

    if (link) {
      link.sendPacketFrom(this, packet);
    } else {
      console.log(`Dropping packet at ${this.label} due to unreachable network`);
    }
  }

  public receivePacket(packet: Packet, link: Link): void {
    if (packet.type === PacketType.LinkUp) {
      let link = <Link>packet.payload;

      if (this.lsdb.indexOf(link) < 0) {
        this.lsdb.push(link);

        setTimeout(() => this.updateRoutingTable());
      }
    } else if (packet.type === PacketType.LinkDown) {
      let link = <Link>packet.payload;
      let idx = this.lsdb.indexOf(link);

      if (idx > 0) {
        this.lsdb.splice(idx, 1);
        setTimeout(() => this.updateRoutingTable());
      }
    } else if (packet.type === PacketType.LSA) {
      this.mergeLsdb(<Link[]>packet.payload);
      setTimeout(() => this.updateRoutingTable());
    }

    packet.ttl = packet.ttl - 1;

    if (packet.ttl <= 0) {
      return;
    }

    if (packet.dstIp === BROADCAST_IP) {
      this.broadcast(packet, [link]);
    } else {
      this.forwardPacket(packet);
    }
  }

  public broadcast(packet: Packet, exclude: Link[]) {
    if (this.cachedBroadcastPkt.indexOf(packet) >= 0) {
      // This packet is already broadcast, a loop is detected

      return;
    }

    this.cachedBroadcastPkt.push(packet);

    setTimeout(() => {
      this.cachedBroadcastPkt.filter(_pkt => _pkt !== packet);
    }, BROADCAST_CACHE_INTERVAL);

    for (let intf of this.interfaces) {
      if (exclude.indexOf(intf.link) > 0) {
        continue;
      }

      intf.link.sendPacketFrom(this, packet);
    }
  }

  public attachLink(link: Link, ip: string): void {
    super.attachLink(link, ip);

    if (this.lsdb.indexOf(link) < 0) {
      this.lsdb.push(link);
    }

    this.advertiseNewLink(link);

    let otherEnd = link.getOtherEnd(this);

    if (otherEnd instanceof Router) {
      this.learnLsdb(otherEnd);
      this.advertiseLsdb(link);
    }

    setTimeout(() => {
      this.updateRoutingTable();
    });
  }

  public detachLink(link: Link): void {
    super.detachLink(link);

    let idx = this.lsdb.indexOf(link);

    if (idx >= 0) {
      this.lsdb.splice(idx, 1);
    }

    this.advertiseLinkRemoval(link);

    setTimeout(() => {
      this.updateRoutingTable();
    });
  }

  public learnLsdb(fromRouter: Router): void {
    this.mergeLsdb(fromRouter.lsdb);
  }

  public mergeLsdb(lsdb: Link[]): void {
    let uniqued = new Set([...this.lsdb, ...lsdb]);
    let merged: Link[] = [];

    uniqued.forEach(link => merged.push(link));

    this.lsdb = merged;
  }

  public advertiseNewLink(link: Link): void {
    let packet = new Packet(BROADCAST_IP, BROADCAST_IP, PacketType.LinkUp,
      0, OSPF_SIZE, link);

    this.broadcast(packet, [link]);
  }

  public advertiseLinkRemoval(link: Link): void {
    let packet = new Packet(BROADCAST_IP, BROADCAST_IP, PacketType.LinkDown,
      0, OSPF_SIZE, link);

    this.broadcast(packet, [link]);
  }

  public advertiseLsdb(link: Link): void {
    let packet = new Packet(BROADCAST_IP, BROADCAST_IP, PacketType.LSA, 0,
      OSPF_SIZE, this.lsdb);

    this.broadcast(packet, [link]);
  }

  public advertiseLsa(link: Link): void {
    let packet = new Packet(BROADCAST_IP, BROADCAST_IP, PacketType.LSA, 0,
      OSPF_SIZE, []);

    this.broadcast(packet, []);
  }

  public updateRoutingTable(): void {
    if (this.lsdb.length === 0) {
      return;
    }

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
      graph.addEdge(new jsgraphs.Edge(dstIdx, srcIdx, link.metric));
    }

    let dijkstra = new jsgraphs.Dijkstra(graph, idToIdx[this.id]);
    let routingTable: Route[] = [];

    for (let host of knownHostList) {
      let idx = idToIdx[host.id];

      if (!dijkstra.hasPathTo(idx)) {
        continue;
      }

      let firstHop = dijkstra.pathTo(idToIdx[host.id])[0];
      let nextHop = idxToDevice[firstHop.to()];

      routingTable.push(new Route(host.getIp(), nextHop));
    }

    this.routingTable = routingTable;

    this.updateFib();
  }

  private updateFib(): void {
    let hopLinkMap: { [hopId: string]: Link } = {};
    let fib: { [ip: string]: Link } = {};

    for (let intf of this.interfaces) {
      let link = intf.link;

      hopLinkMap[link.getOtherEnd(this).id] = link;
    }

    for (let route of this.routingTable) {
      let link = hopLinkMap[route.nextHop.id];

      if (link) {
        fib[route.ip] = link;
      }
    }

    this.fib = fib;
  }
}

const DEFAULT_CAP = 10;
const DEFAULT_DELAY = 10;
const DEFAULT_LOSS_RATE = 0.1;
const DEFAULT_BUFFER_SIZE = 64;
const DEFAULT_METRIC = 1;
const BYTES_IN_KB = 1024;
const BYTES_PER_MBPS = 1024 * 1024 / 8;

export class Link {
  public isLink: boolean = true;
  public capacity: number = DEFAULT_CAP;
  public delay: number = DEFAULT_DELAY;
  public lossRate: number = DEFAULT_LOSS_RATE;
  public bufferSize: number = DEFAULT_BUFFER_SIZE;
  public metric: number = DEFAULT_METRIC;

  private srcBuffer = new Deque();
  private dstBuffer = new Deque();
  private srcBufferUsed: number = 0;
  private dstBufferUsed: number = 0;

  private srcSending: boolean = false;
  private dstSending: boolean = false;

  private srcLatencyData: number[] = [];
  private srcLostPktCounter: number = 0;
  private srcSentPktCounter: number = 0;
  private srcThroughputCounter: number = 0;

  private dstLatencyData: number[] = [];
  private dstLostPktCounter: number = 0;
  private dstSentPktCounter: number = 0;
  private dstThroughputCounter: number = 0;

  private srcTransTimer: number;
  private dstTransTimer: number;

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

  public sendPacketFrom(source: Device, packet: Packet): void {
    if (source === this.src) {
      let newSrcBufferSize = this.srcBufferUsed + packet.size;

      if (newSrcBufferSize > this.bufferSize * BYTES_IN_KB) {
        console.log(`Dropping packets at ${this.id} due to buffer overflow.`);

        return;
      }

      this.srcBuffer.push(packet);
      this.srcBufferUsed = newSrcBufferSize;

      if (!this.srcSending) {
        this.sendFromSrcBuffer();
      }
    } else {
      let newDstBufferSize = this.dstBufferUsed + packet.size;

      if (newDstBufferSize > this.bufferSize * BYTES_IN_KB) {
        console.log(`Dropping packets at ${this.id} due to buffer overflow.`);

        return;
      }

      this.dstBuffer.push(packet);
      this.dstBufferUsed = newDstBufferSize;

      if (!this.dstSending) {
        this.sendFromDstBuffer();
      }
    }
  }

  private sendFromSrcBuffer(): void {
    this.srcSending = true;

    if (this.srcBuffer.isEmpty()) {
      this.srcSending = false;

      return;
    }

    let packet = <Packet>this.srcBuffer.shift();

    this.srcBufferUsed = this.srcBufferUsed - packet.size;
    this.srcSentPktCounter++;

    packet.markSent();

    if (Math.random() * 100 < this.lossRate) {
      this.srcLostPktCounter++;
      console.log(`Packet lost at ${this.id}`);

      return;
    }

    let sendingTime = this.delay + packet.size / (this.capacity * BYTES_PER_MBPS);

    this.srcTransTimer = setTimeout(() => {
      packet.markReceived();
      this.srcLatencyData.push(packet.getTransTime());
      this.srcThroughputCounter = this.srcThroughputCounter + packet.size;

      setTimeout(() => {
        this.dst.receivePacket(packet, this);
      });

      this.sendFromSrcBuffer();
    }, sendingTime * TIME_SLOWDOWN);
  }

  private sendFromDstBuffer(): void {
    this.dstSending = true;

    if (this.dstBuffer.isEmpty()) {
      this.dstSending = false;

      return;
    }

    let packet = <Packet>this.dstBuffer.shift();

    this.dstBufferUsed = this.dstBufferUsed - packet.size;
    this.dstSentPktCounter++;

    packet.markSent();

    if (Math.random() * 100 < this.lossRate) {
      this.dstLostPktCounter++;
      console.log(`Packet lost at ${this.id}`);

      return;
    }

    let sendingTime = this.delay + packet.size / (this.capacity * BYTES_PER_MBPS);

    this.dstTransTimer = setTimeout(() => {
      packet.markReceived();
      this.dstLatencyData.push(packet.getTransTime());
      this.dstThroughputCounter = this.dstThroughputCounter + packet.size;

      setTimeout(() => {
        this.src.receivePacket(packet, this);
      });

      this.sendFromDstBuffer();
    }, Math.floor(sendingTime * TIME_SLOWDOWN));
  }

  public cleanUp(): void {
    // Stop ongoing transmission
    clearTimeout(this.srcTransTimer);
    clearTimeout(this.dstTransTimer);
  }

  public updateMetric(metric: number): void {
    this.metric = metric;

    for (let node of [this.src, this.dst]) {
      if (node instanceof Router) {
        node.advertiseLsa(this);
      }
    }
  }
}

export class Interface {
  constructor(public port: number, public ip: string, public link: Link) {}
}

export class Route {
  constructor(public ip: string, public nextHop: Device) {}
}

export enum PacketType {
  Payload,
  Ack,
  LinkUp,
  LinkDown,
  LSA
}

const INIT_TTL = 64;

export class Packet {
  public ttl: number = INIT_TTL;
  private sentTime: number;
  private receivedTime: number;

  constructor(public srcIp: string, public dstIp: string, public type: PacketType,
    public sequenceNumber: number, public size: number, public payload?: any) {
  }

  public markSent(): void {
    this.sentTime = Date.now();
  }

  public markReceived(): void {
    this.receivedTime = Date.now();
  }

  public getTransTime(): number {
    return this.receivedTime - this.sentTime;
  }
}
