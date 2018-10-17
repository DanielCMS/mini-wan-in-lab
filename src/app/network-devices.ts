import { Subject } from 'rxjs';
import { Vector } from './vector';
import * as jsgraphs from 'js-graph-algorithms';
import * as Deque from 'double-ended-queue';
import { TIME_SLOWDOWN, BROADCAST_IP, OSPF_SIZE, PKT_SIZE,
  HEADER_SIZE, PAYLOAD_SIZE, CTL_SIZE, RWND_INIT, SSTHRESH_INIT,
  ALPHA, BETA, MIN_RTO, IPv4, MEGA } from './constants';
import { v4 } from 'uuid';
import { SeriesPoint } from './series-point';

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
  public flowList: Flow[] = [];
  public receiveList: FlowReceived[] = [];
  public algorithm: string;
  public hasInvalidFormat: boolean = false;

  constructor(public id: string, public label: string, public position: Vector) {
    super(id, label, position);

    this.position = {
      x: this.position.x - 12,
      y: this.position.y + 25
    };
    this.algorithm = "Reno";

    this.flowList = [];
    this.receiveList = [];
  }

  addNewFlow(dest: string, data: number, startTime: number): void {
    if (IPv4.test(dest) && data > 0 && startTime >= 0) {
      let id = v4();
      this.flowList.push(new Flow(id, this, dest, data, startTime));
    } else {
      this.hasInvalidFormat = true;
    }
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

    let flowId = packet.getFlowId();

    if (packet.type === PacketType.Syn) {
      let flow = new FlowReceived(flowId);

      this.receiveList.push(flow); // Establish the session

      let pkt = new Packet(flowId, this.getIp(), packet.srcIp, PacketType.SynAck, 0, CTL_SIZE);

      setTimeout(() => this.sendPacket(pkt));

      return;
    }

    if (packet.type === PacketType.SynAck) {
      let flows = this.flowList.filter(r => r.flowId === flowId);

      if (flows.length > 0){
        let flow = flows[0];

        flow.onReceive(packet);
      }

      return;
    }

    if (packet.type === PacketType.Payload) {
      let flows = this.receiveList.filter(r => r.flowId === flowId);
      if (flows.length > 0) {
        let flow = flows[0];

        flow.onReceive(packet);

        let pkt = new Packet(flowId, this.getIp(), packet.srcIp, PacketType.Ack, flow.getAckSeqNum(), CTL_SIZE);

        setTimeout(()=>this.sendPacket(pkt));
      }
      return;
    }

    if (packet.type === PacketType.Ack) {
      let flows = this.flowList.filter(r => r.flowId === flowId);
      if (flows.length > 0) {
        let flow = flows[0];
        flow.onReceive(packet);
      }
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
      this.cachedBroadcastPkt = this.cachedBroadcastPkt.filter(_pkt => _pkt !== packet);
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
    let packet = new Packet(0, BROADCAST_IP, BROADCAST_IP, PacketType.LinkUp,
      0, OSPF_SIZE, link);

    this.broadcast(packet, [link]);
  }

  public advertiseLinkRemoval(link: Link): void {
    let packet = new Packet(0, BROADCAST_IP, BROADCAST_IP, PacketType.LinkDown,
      0, OSPF_SIZE, link);

    this.broadcast(packet, [link]);
  }

  public advertiseLsdb(link: Link): void {
    let packet = new Packet(0, BROADCAST_IP, BROADCAST_IP, PacketType.LSA, 0,
      OSPF_SIZE, this.lsdb);

    this.broadcast(packet, [link]);
  }

  public advertiseLsa(link: Link): void {
    let packet = new Packet(0, BROADCAST_IP, BROADCAST_IP, PacketType.LSA, 0,
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
const DEFAULT_LOSS_RATE = 0;
const DEFAULT_BUFFER_SIZE = 64;
const DEFAULT_METRIC = 100;
const BYTES_IN_KB = 1024;
const BYTES_PER_MBPS = 1024 * 1024 / 8;
const STATS_UPDATE_INTERVAL = 1000; // 1s
const MAX_STATS_LENGTH = 80;
const AVG_LENGTH = 0.25 * TIME_SLOWDOWN;

export class Link {
  public isLink: boolean = true;
  public capacity: number = DEFAULT_CAP;
  public delay: number = DEFAULT_DELAY;
  public lossRate: number = DEFAULT_LOSS_RATE;
  public bufferSize: number = DEFAULT_BUFFER_SIZE;
  public metric: number = DEFAULT_METRIC;

  public latencyStats: SeriesPoint[][] = [];
  public packetLossStats: SeriesPoint[][] = [];
  public throughputStats: SeriesPoint[][] = [];
  public bufferSizeStats: SeriesPoint[][] = [];

  private srcBuffer = new Deque();
  private dstBuffer = new Deque();
  private srcBufferUsed: number = 0;
  private dstBufferUsed: number = 0;

  private srcSending: boolean = false;
  private dstSending: boolean = false;

  private srcLatencyData: number[] = [];
  private srcBufferData: number[] = [];
  private srcLostPktCounter: number = 0;
  private srcThroughputCounter: number = 0;

  private srcLatencyRaw: number[] = [];
  private srcLatencyStats: SeriesPoint[] = [];
  private srcPacketLossStats: SeriesPoint[] = [];
  private srcThroughputRaw: number[] = [];
  private srcThroughputStats: SeriesPoint[] = [];
  private srcBufferSizeRaw: number[] = [];
  private srcBufferSizeStats: SeriesPoint[] = [];
  private srcLastUpdated: number;

  private dstLatencyData: number[] = [];
  private dstBufferData: number[] = [];
  private dstLostPktCounter: number = 0;
  private dstThroughputCounter: number = 0;

  private dstLatencyRaw: number[] = [];
  private dstLatencyStats: SeriesPoint[] = [];
  private dstPacketLossStats: SeriesPoint[] = [];
  private dstThroughputRaw: number[] = [];
  private dstThroughputStats: SeriesPoint[] = [];
  private dstBufferSizeRaw: number[] = [];
  private dstBufferSizeStats: SeriesPoint[] = [];
  private dstLastUpdated: number;

  private srcTransTimer: number;
  private dstTransTimer: number;
  private srcNextTimer: number;
  private dstNextTimer: number;
  private srcStatsTimer: number;
  private dstStatsTimer: number;

  constructor(public id: string, public src: Device, public dst: Device) {
    let now = Date.now();

    this.srcLastUpdated = now;
    this.dstLastUpdated = now;

    this.updateSrcStats();
    this.updateDstStats();
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

      if (newSrcBufferSize > this.bufferSize * BYTES_IN_KB && source instanceof Router) {
        console.log(`Dropping packets at ${this.id} due to buffer overflow.`);

        return;
      }

      this.srcBuffer.push(packet);
      this.srcBufferData.push(newSrcBufferSize);
      this.srcBufferUsed = newSrcBufferSize;

      if (!this.srcSending) {
        this.sendFromSrcBuffer();
      }
    } else {
      let newDstBufferSize = this.dstBufferUsed + packet.size;

      if (newDstBufferSize > this.bufferSize * BYTES_IN_KB && source instanceof Router) {
        console.log(`Dropping packets at ${this.id} due to buffer overflow.`);

        return;
      }

      this.dstBuffer.push(packet);
      this.srcBufferData.push(newDstBufferSize);
      this.dstBufferUsed = newDstBufferSize;

      if (!this.dstSending) {
        this.sendFromDstBuffer();
      }
    }
  }

  private notifyStatsUpdate(): void {
    this.latencyStats = [this.srcLatencyStats, this.dstLatencyStats];
    this.throughputStats = [this.srcThroughputStats, this.dstThroughputStats];
    this.packetLossStats = [this.srcPacketLossStats, this.dstPacketLossStats];
    this.bufferSizeStats = [this.srcBufferSizeStats, this.dstBufferSizeStats];
  }

  private pushRawAndGetAvg(value: number, raw: number[]): number {
    raw.push(value);

    if (raw.length > AVG_LENGTH) {
      raw.shift();
    }

    return raw.reduce((last, next) => last + next, 0) / Math.max(raw.length, 1);
  }

  private updateSrcStats(): void {
    let now = Date.now();

    // Update latency
    let latencyAvg = this.srcLatencyData
      .reduce((last, next) => last + next, 0) / this.srcLatencyData.length / TIME_SLOWDOWN;

    if (isNaN(latencyAvg)) {
      latencyAvg = this.delay;
    }

    latencyAvg = this.pushRawAndGetAvg(latencyAvg, this.srcLatencyRaw);

    this.srcLatencyStats.push({
      time: now,
      value: latencyAvg
    });

    if (this.srcLatencyStats.length > MAX_STATS_LENGTH) {
      this.srcLatencyStats.shift();
    }

    this.srcLatencyData = [];

    // Update buffer size
    let bufferAvg = this.srcBufferData
      .reduce((last, next) => last + next, 0) / Math.max(this.srcBufferData.length, 1) / BYTES_IN_KB;

    bufferAvg = this.pushRawAndGetAvg(bufferAvg, this.srcBufferSizeRaw);

    this.srcBufferSizeStats.push({
      time: now,
      value: bufferAvg
    });

    this.srcBufferData = [];

    if (this.srcBufferSizeStats.length > MAX_STATS_LENGTH) {
      this.srcBufferSizeStats.shift();
    }

    // Update pakcet loss
    this.srcPacketLossStats.push({
      time: now,
      value: this.srcLostPktCounter
    });

    if (this.srcPacketLossStats.length > MAX_STATS_LENGTH) {
      this.srcPacketLossStats.shift()
    }

    this.srcLostPktCounter = 0;

    // Update throughput
    let throughput = this.srcThroughputCounter / (now - this.srcLastUpdated) * TIME_SLOWDOWN / 125;
    let avg = this.pushRawAndGetAvg(throughput, this.srcThroughputRaw);

    this.srcThroughputStats.push({
      time: now,
      value: avg
    });

    if (this.srcThroughputStats.length > MAX_STATS_LENGTH) {
      this.srcThroughputStats.shift();
    }

    this.srcLastUpdated = now;
    this.srcThroughputCounter = 0;

    // Schedule a future updates
    this.srcStatsTimer = setTimeout(() => {
      this.updateSrcStats();
    }, STATS_UPDATE_INTERVAL);

    // Notify a redraw
    this.notifyStatsUpdate();
  }

  private updateDstStats(): void {
    let now = Date.now();

    // Update latency
    let latencyAvg = this.dstLatencyData
      .reduce((last, next) => last + next, 0) / this.dstLatencyData.length / TIME_SLOWDOWN;

    if (isNaN(latencyAvg)) {
      latencyAvg = this.delay;
    }

    latencyAvg = this.pushRawAndGetAvg(latencyAvg, this.dstLatencyRaw);

    this.dstLatencyStats.push({
      time: now,
      value: latencyAvg
    });

    if (this.dstLatencyStats.length > MAX_STATS_LENGTH) {
      this.dstLatencyStats.shift();
    }

    this.dstLatencyData = [];

    // Update buffer size
    let bufferAvg = this.dstBufferData
      .reduce((last, next) => last + next, 0) / Math.max(this.dstBufferData.length, 1) / BYTES_IN_KB;

    bufferAvg = this.pushRawAndGetAvg(bufferAvg, this.dstBufferSizeRaw);

    this.dstBufferSizeStats.push({
      time: now,
      value: bufferAvg
    });

    this.dstBufferData = [];

    if (this.dstBufferSizeStats.length > MAX_STATS_LENGTH) {
      this.dstBufferSizeStats.shift();
    }

    // Update pakcet loss
    this.dstPacketLossStats.push({
      time: now,
      value: this.dstLostPktCounter
    });

    if (this.dstPacketLossStats.length > MAX_STATS_LENGTH) {
      this.dstPacketLossStats.shift();
    }

    this.dstLostPktCounter = 0;

    // Update throughput
    let throughput = this.dstThroughputCounter / (now - this.dstLastUpdated) * TIME_SLOWDOWN / 125;
    let avg = this.pushRawAndGetAvg(throughput, this.dstThroughputRaw);

    this.dstThroughputStats.push({
      time: now,
      value: avg
    });

    if (this.dstThroughputStats.length > MAX_STATS_LENGTH) {
      this.dstThroughputStats.shift();
    }

    this.dstLastUpdated = now;
    this.dstThroughputCounter = 0;

    // Schedule a future updates
    this.dstStatsTimer = setTimeout(() => {
      this.updateDstStats();
    }, STATS_UPDATE_INTERVAL);

    // Notify a redraw
    this.notifyStatsUpdate();
  }

  private sendFromSrcBuffer(): void {
    this.srcSending = true;

    if (this.srcBuffer.isEmpty()) {
      this.srcSending = false;

      return;
    }

    let packet = <Packet>this.srcBuffer.shift();

    this.srcBufferUsed = this.srcBufferUsed - packet.size;
    packet.markSent();

    this.srcNextTimer = setTimeout(() => {
      this.sendFromSrcBuffer();
    }, packet.size / (this.capacity * BYTES_PER_MBPS) * TIME_SLOWDOWN * 1000);

    if (Math.random() * 100 < this.lossRate) {
      this.srcLostPktCounter++;
      console.log(`Packet lost at ${this.id}`);

      return;
    }

    let sendingTime = this.delay + packet.size / (this.capacity * BYTES_PER_MBPS) * 1000;

    this.srcTransTimer = setTimeout(() => {
      packet.markReceived();
      this.srcLatencyData.push(packet.getTransTime());
      this.srcThroughputCounter = this.srcThroughputCounter + packet.size;

      setTimeout(() => {
        this.dst.receivePacket(packet, this);
      });
    }, Math.floor(sendingTime * TIME_SLOWDOWN));
  }

  private sendFromDstBuffer(): void {
    this.dstSending = true;

    if (this.dstBuffer.isEmpty()) {
      this.dstSending = false;

      return;
    }

    let packet = <Packet>this.dstBuffer.shift();

    this.dstBufferUsed = this.dstBufferUsed - packet.size;
    packet.markSent();

    this.dstNextTimer = setTimeout(()=>{
      this.sendFromDstBuffer();
    }, packet.size / (this.capacity * BYTES_PER_MBPS) * TIME_SLOWDOWN * 1000);

    if (Math.random() * 100 < this.lossRate) {
      this.dstLostPktCounter++;
      console.log(`Packet lost at ${this.id}`);

      return;
    }

    let sendingTime = this.delay + packet.size / (this.capacity * BYTES_PER_MBPS) * 1000;

    this.dstTransTimer = setTimeout(() => {
      packet.markReceived();
      this.dstLatencyData.push(packet.getTransTime());
      this.dstThroughputCounter = this.dstThroughputCounter + packet.size;

      setTimeout(() => {
        this.src.receivePacket(packet, this);
      });

    }, Math.floor(sendingTime * TIME_SLOWDOWN));
  }

  public cleanUp(): void {
    // Stop ongoing transmission
    clearTimeout(this.srcTransTimer);
    clearTimeout(this.dstTransTimer);
    clearTimeout(this.srcNextTimer);
    clearTimeout(this.dstNextTimer);
    clearTimeout(this.srcStatsTimer);
    clearTimeout(this.dstStatsTimer);
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
  LSA,
  Syn,
  SynAck
}

const INIT_TTL = 64;

export class Packet {
  public ttl: number = INIT_TTL;
  private sentTime: number;
  private receivedTime: number;

  constructor(public flowId:number, public srcIp: string, public dstIp: string, public type: PacketType,
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

  public getFlowId(): number {
    return this.flowId;
  }
}

export class Flow {

  public initTime: number;
  public waitingTime: number;
  public flowSource: string;
  public flowDestination: string;
  public dataRemaining: number;
  public algorithm: AlgType;
  public flowStatus: FlowStatus = FlowStatus.Waiting;
  public cwnd: number = 1;
  public RTT: number;
  public RTO: number;
  public ssthresh: number = SSTHRESH_INIT;
  public windowStart: number = 0;
  public toSend: number;
  public maxAck: number = 0;
  public maxAckDup: number = 0;
  public timeSYN: number;
  public seqNum: number = 0;
  public packetsOnFly: Packet[] = [];

  private congestionControl: CongestionControlAlg;
  private RTOTimer: number;

  constructor(public flowId: number, public sendingHost: Host, public destIP: string, public data: number, public time: number) {
    this.flowSource = sendingHost.getIp();
    this.flowDestination = destIP + "/24";
    this.dataRemaining = data * MEGA; // in Bytes
    this.waitingTime = time;
    this.initTime = Date.now();

    this.congestionControl = new Reno(this);

    for (let n = 0; n < time; n++) {
      setTimeout(() => this.countDown(), (n + 1) * 1000);
    }

    setTimeout(() => this.handShake(), time * 1000);
  }

  private countDown(): void {
    this.waitingTime--;
  }

  private handShake(): void {
    this.flowStatus = FlowStatus.HandShake;
    this.timeSYN = Date.now();
    let packet =  new Packet(this.flowId, this.flowSource, this.flowDestination, PacketType.Syn, 0, CTL_SIZE);

    setTimeout(() => this.sendingHost.sendPacket(packet));
  }

  private updateRTT(RTT: number): void {
    if (this.RTT) {
      this.RTT = (1 - ALPHA) * this.RTT + ALPHA * RTT;
    } else {
      this.RTT = RTT;
    }
  }

  private updateRTO(): void {
    this.RTO = Math.max(this.RTT * BETA, MIN_RTO);
  }

  public onReceive(packet: Packet): void {
    if (packet.type === PacketType.SynAck) {
      let ack = new Packet(this.flowId, this.flowSource, this.flowDestination, PacketType.Ack, 1, CTL_SIZE);

      setTimeout(() => this.sendingHost.sendPacket(ack));

      this.updateRTT(Date.now() - this.timeSYN);
      this.updateRTO();
      this.flowStatus = FlowStatus.SS;
    }

    if (packet.type === PacketType.Ack) {
      this.windowStart = packet.sequenceNumber;
      this.packetsOnFly = this.packetsOnFly.filter(pkt => pkt.sequenceNumber >= packet.sequenceNumber);

      if (this.packetsOnFly.length === 0 && this.dataRemaining <= 0) {
        this.flowStatus = FlowStatus.Complete;

        return;
      }

      if (packet.sequenceNumber > this.maxAck) {
        this.maxAck = packet.sequenceNumber;
        this.maxAckDup = 1;

        this.onReceiveNewAck();
      } else {
        this.maxAckDup++;
        this.onReceiveDupAck();
      }
    }

    this.send();
  }

  private restartRTO(): void {
    clearTimeout(this.RTOTimer);
    this.RTOTimer = setTimeout(() => {
      this.onTimeout();
    }, this.RTO);
  }

  private collapseSsthresh(): void {
    let flightSize = this.packetsOnFly.length;

    this.ssthresh = Math.floor(Math.max(flightSize / 2, 2));
  }

  private retransmit(): void {
    let pkt = this.packetsOnFly[0];

    if (pkt) {
      setTimeout(() => this.sendingHost.sendPacket(<Packet>pkt));
    }
  }

  private onReceiveNewAck(): void {
    if (this.flowStatus === FlowStatus.SS) {
      this.cwnd++;

      if (this.cwnd >= this.ssthresh) {
        this.flowStatus = FlowStatus.CA;
      }
    }

    this.restartRTO();
    this.congestionControl.onReceiveNewAck();
  }

  private onReceiveDupAck(): void {
    if (this.maxAckDup === 3) {
      // 3 dup ACK, packet lost
      this.retransmit();
      this.collapseSsthresh();
    }

    this.congestionControl.onReceiveDupAck();
  }

  private createPacket(): (Packet | void) {
    if (this.dataRemaining <= 0) {
      return;
    }

    let pktSize = Math.min(this.dataRemaining, PAYLOAD_SIZE);
    let packet = new Packet(this.flowId, this.flowSource, this.flowDestination, PacketType.Payload, this.seqNum, HEADER_SIZE + pktSize)

    this.seqNum++;
    this.dataRemaining = this.dataRemaining - pktSize;

    return packet;
  }

  private send(): void {
    let stop = this.windowStart + this.cwnd;

    while (this.seqNum < stop) {
      let pkt = this.createPacket();

      if (pkt) {
        setTimeout(() => this.sendingHost.sendPacket(<Packet>pkt));
        this.packetsOnFly.push(pkt);
      } else {
        break;
      }
    }
  }

  private onTimeout(): void {
    this.retransmit();
    this.collapseSsthresh();

    // Exponential backoff
    this.RTO = this.RTO * 2;
    this.restartRTO();

    this.cwnd = 1;
    this.flowStatus = FlowStatus.SS;
  }
}

export interface CongestionControlAlg {
  onReceiveNewAck(): void;
  onReceiveDupAck(): void;
}

export class Tahoe implements CongestionControlAlg {
  constructor(public flow: Flow) {}

  public onReceiveNewAck(): void {
    let flow = this.flow;

    if (flow.flowStatus === FlowStatus.CA) {
      flow.cwnd = flow.cwnd + 1 / flow.cwnd;
    }
  }

  public onReceiveDupAck(): void {
    let flow = this.flow;

    if (flow.maxAckDup === 3) {
      flow.cwnd = 1;
      flow.flowStatus = FlowStatus.CA;
    }
  }
}

export class Reno implements CongestionControlAlg {
  constructor(public flow: Flow) {}

  public onReceiveNewAck(): void {
    let flow = this.flow;

    if (flow.flowStatus === FlowStatus.FRFR) {
      flow.cwnd = flow.ssthresh;
      flow.flowStatus = FlowStatus.CA;
    } else if (flow.flowStatus === FlowStatus.CA) {
      flow.cwnd = flow.cwnd + 1 / flow.cwnd;
    }
  }

  public onReceiveDupAck(): void {
    let flow = this.flow;

    if (flow.maxAckDup === 3) {
      flow.cwnd = flow.ssthresh + 3;
      flow.flowStatus = FlowStatus.FRFR;
    } else if (flow.maxAckDup > 3) {
      flow.cwnd = flow.cwnd + 1;
    }
  }
}

export class FlowReceived {
  public flowId: number; // id of the received flow
  public rwnd: number; // Receive window size
  public pktRecieved: number[]; // seq numbers of received packets
  public nextAck: number; // seq number of the the next Ack packet

  constructor(public id: number) {
    this.flowId = id;
    this.rwnd = RWND_INIT;
    this.pktRecieved = [];
    this.nextAck = 1;
  }

  public onReceive(packet: Packet): void {
    this.pktRecieved.push(packet.sequenceNumber);
    if (this.pktRecieved.length > this.rwnd) {
      this.pktRecieved.shift();
    }
    while(this.pktRecieved.includes(this.nextAck)) {
      this.nextAck++;
    }
  }

  public getAckSeqNum(): number {
    return this.nextAck;
  }
}

export enum AlgType {
  Reno,
  Vegas,
  FAST
}

export enum FlowStatus {
  Waiting,
  Complete,
  SS, // slow start
  CA, // comgestion avoidance
  FRFR,// fast retansmit/fast recovery
  HandShake
}
